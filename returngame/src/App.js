import React, { useState, useEffect, useRef, useMemo} from 'react';
import { createPortal } from 'react-dom';
import { db, collection, doc, getDoc, setDoc, onSnapshot } from './firebase';
import { updateDoc, arrayUnion, runTransaction, increment } from 'firebase/firestore';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import ScrollToTop from './ScrollToTop';
import projectsData from './projects.json';
import timelineData from './timelineData.json';
import './App.css';


// 사진 모달 컴포넌트
function PhotoModal({ photos, currentIndex, onClose, onPrev, onNext }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div className="photo-modal-overlay">
      <div className="photo-modal">
        <button className="close-button" onClick={onClose}>x</button>
        <img
          src={photos[currentIndex]}
          alt={`Slide ${currentIndex + 1}`}
          className="modal-photo"
        />
        <div className="modal-controls">
          <button onClick={onPrev}>←</button>
          <button onClick={onNext}>→</button>
        </div>
      </div>
    </div>
  );
}

// 줄바꿈 함수 + 링크 자동 삽입
const formatTextWithLineBreaks = (text) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const curlyRegex = /(\{[^}]+\})/g;
  return text.split(curlyRegex).map((segment, index) => {
    if (curlyRegex.test(segment)) {
      return (
        <span key={index} className="gray-text">
          {segment}
        </span>
      );
    }

    // URL 감지 + 줄바꿈 처리
    return segment.split(urlRegex).map((part, idx) => {
      if (urlRegex.test(part)) {
        // 링크로 변환
        return (
          <a
            key={`${index}-${idx}`}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
          >
            {part}
          </a>
        );
      }
      // 줄바꿈 처리
      const lines = part.split('\n');
      return (
        <span key={`${index}-${idx}`}>
          {lines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < lines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </span>
      );
    });
  });
};

// 광고 배너 컴포넌트
const AdFitBanner = ({

  // PC형 광고
  adUnit = "DAN-cbhNH2DQGsz5BG5u",
  width  = 728,
  height = 90,
  // 모바일형 광고
  mobileAdUnit = "DAN-5HHAjw0y2pRiS3R9",
  mobileWidth  = 320,
  mobileHeight = 100
}) => {
  const ref = useRef(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    container.innerHTML = '';

    const isMobile = window.innerWidth <= 768;
    const unit   = isMobile ? mobileAdUnit : adUnit;
    const w      = isMobile ? mobileWidth  : width;
    const h      = isMobile ? mobileHeight : height;

    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';
    ins.setAttribute('data-ad-unit',   unit);
    ins.setAttribute('data-ad-width',  String(w));
    ins.setAttribute('data-ad-height', String(h));
    container.appendChild(ins);

    const script = document.createElement('script');
    script.src   = '//t1.daumcdn.net/kas/static/ba.min.js';
    script.async = true;
    container.appendChild(script);

    return () => {
      if (window.adfit?.destroy) window.adfit.destroy(unit);
      container.innerHTML = '';
    };
  }, [
    adUnit, width, height,
    mobileAdUnit, mobileWidth, mobileHeight
  ]);

  return <div ref={ref} className="adfit-container" style={{ textAlign: 'center' }}/>;
};

// 메인 페이지
function Home() {
  const SHOW_HOME_AD = false;

  
  const TITLE_TEXT = '@return Game;';
  const [titleIndex, setTitleIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      if (titleIndex !== TITLE_TEXT.length) setTitleIndex(TITLE_TEXT.length);
      return;
    }

    const typeSpeed = isDeleting ? 70 : 135;
    const pauseAfterTyped = 2000;
    const pauseAfterDeleted = 350;

    let t;
    if (!isDeleting && titleIndex === TITLE_TEXT.length) {
      t = window.setTimeout(() => setIsDeleting(true), pauseAfterTyped);
    } else if (isDeleting && titleIndex === 0) {
      t = window.setTimeout(() => setIsDeleting(false), pauseAfterDeleted);
    } else {
      t = window.setTimeout(
        () => setTitleIndex(i => i + (isDeleting ? -1 : 1)),
        typeSpeed
      );
    }

    return () => window.clearTimeout(t);
  }, [TITLE_TEXT, titleIndex, isDeleting]);

  const typedTitle = TITLE_TEXT.slice(0, titleIndex);

return (
    <div className="page-container home-page">
      <div className="home-hero">
        <p className="home-tagline">2025학년도 제44회 경황제</p>
        <h1 className="home-title"><span className="home-title-typing" aria-label="@return Game;">{typedTitle}</span></h1>
        <p className="home-subtitle">경희고등학교 게임 개발 동아리</p>
      </div>
      <div className="home-links">
        <Link to="/project" className="home-link-box">
        <span className="material-icons cta-arrow-icon">arrow_forward</span>
          게임 체험하러 가기
        </Link>
      </div>

      {SHOW_HOME_AD && <AdFitBanner />}
    </div>
  );
}

// 프로젝트 리스트 페이지
function Project() {
  const [ratings, setRatings] = useState({});
  const [commentCounts, setCommentCounts] = useState({});
  const [viewCounts, setViewCounts] = useState({});
  const [sortOption, setSortOption] = useState(() => {
    return localStorage.getItem('sortOption') || 'default';
  });

  // 조회수 증가 함수
  const incrementView = async id => {
    const ref = doc(db, 'projectViews', id);
    try {
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (snap.exists()) {
          tx.update(ref, { views: increment(1) });
        } else {
          tx.set(ref, { views: 1 });
        }
      });
    } catch (e) {
      console.error('조회수 증가 실패:', e);
    }
  };

  // 평점 구독
  useEffect(() => {
    const unsubs = projectsData.map(project => {
      const ref = doc(collection(db, 'projectRatings'), project.id);
      return onSnapshot(ref, snap => {
        setRatings(prev => ({
          ...prev,
          [project.id]: snap.exists() ? snap.data().ratings || [] : []
        }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  // 댓글 수 구독
  useEffect(() => {
    const unsubs = projectsData.map(project => {
      const ref = doc(collection(db, 'projectComments'), project.id);
      return onSnapshot(ref, snap => {
        setCommentCounts(prev => ({
          ...prev,
          [project.id]: snap.exists() ? (snap.data().comments || []).length : 0
        }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  // 조회수 구독
  useEffect(() => {
    const unsubs = projectsData.map(project => {
      const ref = doc(collection(db, 'projectViews'), project.id);
      return onSnapshot(ref, snap => {
        setViewCounts(prev => ({
          ...prev,
          [project.id]: snap.exists() ? snap.data().views || 0 : 0
        }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, []);

  const getAverageRating = id => {
    const arr = ratings[id] || [];
    if (arr.length === 0) return '0.0';
    return (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1);
  };
  const getRatingCount = id => (ratings[id] || []).length;
  const getCommentCount = id => commentCounts[id] || 0;

  const sortedProjects = useMemo(() => {
    const list = [...projectsData];
    switch (sortOption) {
      case 'popularity':
        return list.sort(
          (a, b) => (viewCounts[b.id] || 0) - (viewCounts[a.id] || 0)
        );
      case 'rating':
        return list.sort(
          (a, b) => getAverageRating(b.id) - getAverageRating(a.id)
        );
      case 'comments':
        return list.sort(
          (a, b) => (commentCounts[b.id] || 0) - (commentCounts[a.id] || 0)
        );
      default:
        return list;
    }
  }, [sortOption, viewCounts, ratings, commentCounts]);

  // 드롭다운
  const navbar = document.querySelector('.navbar');
  const dropdownPortal = navbar && createPortal(
    <div className="sort-container-portal">
      <select
        className="sort-dropdown"
        value={sortOption}
        onChange={e => {
          const v = e.target.value;
          setSortOption(v);
          localStorage.setItem('sortOption', v);
        }}
      >
        <option value="default">기본순</option>
        <option value="popularity">인기순</option>
        <option value="rating">별점순</option>
        <option value="comments">댓글순</option>
      </select>
    </div>,
    navbar
  );

  return (
    <>
      {dropdownPortal}
      <div className="page-container project-page">
        <ul>
          {sortedProjects.map(project => (
            <li key={project.id}>
              <Link
                to={`/project/${project.id}`}
                className="project-item"
                onClick={() => incrementView(project.id)}
              >
                <div className="project-image-container">
                  <img
                    src={project.imagePath}
                    alt={project.name}
                    className="project-image"
                  />
                </div>
                <div className="project-text-container">
                  <div className="project-text-row">
                    <div className="project-title">
                      {project.name}
                    </div>
                    <div className="project-rating">
                      <span
                        className="material-icons"
                        style={{ fontSize: '18px', marginRight: '4px', color: 'var(--text-dim)', position: 'relative', top: '4px'}}
                      >
                        visibility
                      </span>
                      { viewCounts[project.id] || 0}
                    </div>
                  </div>
                  <div className="project-text-row">
                    <div className="project-subtitle">{project.main_desc}</div>
                    <div className="project-comments-info">
                      <span className="material-icons comment-icon">comment</span>
                      {getCommentCount(project.id)}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
        <Link to="/" className="floating-home-btn" aria-label="메인으로">
          <span className="material-icons">home</span>
        </Link>
    </>
  );
}

// 프로젝트 상세 페이지
function ProjectDetails() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // URL 파라미터로 프로젝트 식별자 가져오기
  const { projectName } = useParams();
  const project = projectsData.find((p) => p.id === projectName);

  // 평점 상태 관리
  const [ratings, setRatings] = useState([]);
  useEffect(() => {
    const projectRatingsRef = doc(collection(db, 'projectRatings'), project.id);
    const unsubscribe = onSnapshot(projectRatingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setRatings(docSnap.data().ratings || []);
      } else {
        setRatings([]);
      }
    });
    return () => unsubscribe();
  }, [project.id]);

  // 댓글 상태 관리
  const [comments, setComments] = useState([]);
  useEffect(() => {
    const projectCommentsRef = doc(collection(db, 'projectComments'), project.id);
    const unsubscribe = onSnapshot(projectCommentsRef, (docSnap) => {
      if (docSnap.exists()) {
        setComments(docSnap.data().comments || []);
      } else {
        setComments([]);
      }
    });
    return () => unsubscribe();
  }, [project.id]);

  // 댓글 입력 폼 상태
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentPassword, setCommentPassword] = useState('');

  if (!project) {
    return <div>프로젝트를 찾을 수 없습니다.</div>;
  }

  // 평점 변경 처리
  const handleRatingChange = async (projectId, newRating) => {
    const projectRatingsRef = doc(collection(db, 'projectRatings'), projectId);
    try {
      const docSnap = await getDoc(projectRatingsRef);
      let updatedRatings = [];
      if (docSnap.exists()) { 
        updatedRatings = [...(docSnap.data().ratings || []), newRating];
      } else {
        updatedRatings = [newRating];
      }
      await setDoc(projectRatingsRef, { ratings: updatedRatings });
    } catch (error) {
      console.error('평점 갱신 중 오류 발생: ', error);
    }
  };

  // 댓글 작성
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !commentPassword.trim()) {
      alert('댓글과 비밀번호를 모두 입력해주세요.');
      return;
    }

    const author = commentAuthor.trim() || '익명';
    const timestamp = new Date().toISOString();

    const newCommentObj = {
      id: Date.now(),
      author,
      text: newComment,
      timestamp,
      password: commentPassword,
    };

    const projectCommentsRef = doc(collection(db, 'projectComments'), project.id);

    try {
      const docSnap = await getDoc(projectCommentsRef);
      if (!docSnap.exists()) {
        await setDoc(projectCommentsRef, { comments: [] });
      }
      await updateDoc(projectCommentsRef, {
        comments: arrayUnion(newCommentObj),
      });

      // 입력 필드 초기화
      setNewComment('');
      setCommentAuthor('');
      setCommentPassword('');
    } catch (error) {
      console.error('Error adding comment: ', error);
    }
  };

  // 댓글 삭제
  const handleDeleteComment = async (commentId) => {
    const commentToDelete = comments.find((c) => c.id === commentId);
    if (!commentToDelete) return;

    const inputPassword = prompt('댓글을 삭제하시려면 비밀번호를 입력하세요:');
    if (inputPassword !== commentToDelete.password) {
      alert('비밀번호가 틀렸습니다.');
      return;
    }

    if (window.confirm('정말로 댓글을 삭제하시겠습니까?')) {
      const projectCommentsRef = doc(collection(db, 'projectComments'), project.id);
      try {
        const docSnap = await getDoc(projectCommentsRef);
        if (docSnap.exists()) {
          const updatedComments = (docSnap.data().comments || []).filter(
            (comment) => comment.id !== commentId
          );
          await setDoc(projectCommentsRef, { comments: updatedComments });
        }
      } catch (error) {
        console.error('Error deleting comment: ', error);
      }
    }
  };

  const userRating = ratings.length > 0 ? ratings[ratings.length - 1] : 0;

  const difficultyValue = Math.max(0, Math.min(5, Number(project.difficulty) || 0));
  const difficultyStars = '★'.repeat(difficultyValue) + '☆'.repeat(5 - difficultyValue);

  // 프로젝트 상세 페이지 UI
  return (
    <div className="page-container project-details-page">
      {/* <div className="mobile-ad-container">
        <AdFitBanner
          adUnit="DAN-5HHAjw0y2pRiS3R9"
          width={320}
          height={100}
          mobileAdUnit="DAN-5HHAjw0y2pRiS3R9"
          mobileWidth={320}
          mobileHeight={100}
        />
      </div>   */}
            <div className="project-layout">
        <div className="game-left">
          {/* 중앙: 게임 플레이 */}
          <div className="game-container">
                    <div className="game-frame-wrapper">
                      {project.embedType === 'youtube' ? (
                        <iframe
                          src={`https://www.youtube.com/embed/${project.youtubeId}`}
                          className="game-iframe"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          title={project.name}
                        />
                      ) : (
                        <iframe
                          src={project.iframeSrc}
                          frameBorder="0"
                          scrolling="no"
                          title={project.name}
                          className="game-iframe"
                        />
                      )}
                    </div>
                    <p className="game-description">{project.description}</p>
                  </div>

          {/* 왼쪽: 게임 방법 및 게임 정보 */}
          <div className="game-instructions">
                    <div className="instruction-box">
                      <div className="instruction-header-row">
                        <div className="instruction-header-left">
                          <span className="instruction-game-title">{project.name}</span>
                          <span className="instruction-game-desc">{project.main_desc}</span>
                        </div>
                        <div className="instruction-header-right">
                          <span className="instruction-developer">{project.developer}</span>
                          <span className="instruction-difficulty">{difficultyStars}</span>
                        </div>
                      </div>
                      <p className="instruction-how">{formatTextWithLineBreaks(project.how)}</p>
                    </div>
                  </div>
        </div>

        {/* 오른쪽: 평점 및 댓글 */}
        <div className="ratings-comments-wrapper">
                  <div className="ratings-comments">
                    <div className="comments-section">
                      {/* 댓글 입력 폼 */}
                      {/* <h2>댓글</h2> */}
                      <form onSubmit={handleAddComment} className="comment-form">
                        <div className="horizontal-inputs">
                          <input
                            type="text"
                            value={commentAuthor}
                            onChange={(e) => setCommentAuthor(e.target.value)}
                            placeholder="닉네임"
                            className="author-input"
                          />
                          <input
                            type="password"
                            value={commentPassword}
                            onChange={(e) => setCommentPassword(e.target.value)}
                            placeholder="비밀번호"
                            className="password-input"
                            required
                          />
                        </div>

                        {/* 댓글 내용 */}
                        <div className="input-group">
                          <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                handleAddComment(e);
                              }
                            }}
                            placeholder="댓글을 입력해주세요 (Enter로 등록)"
                            className="comment-input"
                            required
                          />
                        </div>
                      </form>

                      {/* 댓글 리스트 */}
                      <div className="comments-list">
                        {comments.length > 0 ? (
                          comments.map((comment) => (
                            <div key={comment.id} className="comment-item">
                              <div className="comment-header">
                                <strong>{comment.author}</strong>
                                <span className="comment-date">
                                  {new Date(comment.timestamp).toLocaleDateString()}{' '}
                                  {new Date(comment.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <p className="comment-text">{formatTextWithLineBreaks(comment.text)}</p>
                              <br/>
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="delete-comment-btn"
                              >
                                삭제
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="no-comments">
                            아직 댓글이 없습니다.
                            <br />
                            첫 댓글을 남겨보세요!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
      </div>
{/* <div className="pc-ad-container">
        <AdFitBanner
          adUnit="DAN-cbhNH2DQGsz5BG5u"
          width={728}
          height={90}
        />
      </div> */}
      <Link to="/project" className="floating-rewind-btn" aria-label="앞으로">
        <span className="material-icons">fast_rewind</span>
      </Link>
    </div>
  );
}

// 타임라인 컴포넌트
function Timeline() {
  const [expandedItems, setExpandedItems] = useState({});
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const wonderPotionPhotos = [
    '001.png',
    '002.png',
    '003.png',
    '004.png'
  ];

  const toggleItem = (id) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="timeline-container">
      <div className="timeline-line"></div>
      {timelineData.map((item, index) => (
        <div 
          key={item.id} 
          className={`timeline-item ${index % 2 === 0 ? 'left' : 'right'} ${expandedItems[item.id] ? 'expanded' : ''}`}
          onClick={() => toggleItem(item.id)}
        >
          <div className="timeline-dot"></div>
          <div className="timeline-content">
            <div className="timeline-year">{item.year}</div>
            <h3 className="timeline-title">{item.title}</h3>
            <p className="timeline-short-desc">{item.shortDesc}</p>
            <div className="timeline-details">
              <img 
                src={item.image} 
                alt={item.title} 
                className="timeline-image"
                onError={(e) => {e.target.src = '/api/placeholder/400/300'; e.target.alt = 'Placeholder image'}}
              />
              <p className="timeline-long-desc">{formatTextWithLineBreaks(item.longDesc)}</p>
              {/* id가 2인 경우 링크 추가 */}
              {item.id === 2 && (
                <div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setModalVisible(true);
                    }}
                    className="button-link"
                  >
                    기사 보기
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      {/* 팝업 컴포넌트 */}
      {modalVisible && (
        <PhotoModal 
          photos={wonderPotionPhotos} 
          currentIndex={currentPhotoIndex} 
          onClose={() => setModalVisible(false)}
          onPrev={() =>
            setCurrentPhotoIndex((currentPhotoIndex - 1 + wonderPotionPhotos.length) % wonderPotionPhotos.length)
          }
          onNext={() =>
            setCurrentPhotoIndex((currentPhotoIndex + 1) % wonderPotionPhotos.length)
          }
        />
      )}
    </div>
  );
}

// 소개 페이지
function Introduce() {
  return (
    <div className="page-container">
      <Timeline />
    </div>
  );
}

// 네비게이션 바
function Navbar() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('/');

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setActiveTab('/');
    } else if (path.startsWith('/project')) {
      setActiveTab('/project');
    } else if (path === '/introduce') {
      setActiveTab('/introduce');
    }
  }, [location]);

  return (
    <nav className="navbar">
      <div className="navbar-title">
        <Link to="/">
          <img src="/logo_long.png" alt="logo" className="logo" />
        </Link>
      </div>
      <div className="navbar-links">
        <Link to="/" className={`nav-link ${activeTab === '/' ? 'active' : ''}`}>
          홈
        </Link>
        <Link to="/project" className={`nav-link ${activeTab === '/project' ? 'active' : ''}`}>
          프로젝트
        </Link>
        <Link to="/introduce" className={`nav-link ${activeTab === '/introduce' ? 'active' : ''}`}>
          소개
        </Link>
      </div>
    </nav>
  );
}

// Animation
function AnimatedRoutes() {
  const location = useLocation();

  return (
    <div className="content">
      <Routes location={location}>
        <Route 
          path="/" 
          element={
            <div key="home" className="animated-page fadeIn">
              <Home />
            </div>
          } 
        />
        <Route 
          path="/project" 
          element={
            <div key="project" className="animated-page fadeIn">
              <Project />
            </div>
          } 
        />
        <Route 
          path="/introduce" 
          element={
            <div key="introduce" className="animated-page fadeIn">
              <Introduce />
            </div>
          } 
        />
        <Route 
          path="/project/:projectName" 
          element={
            <div key="project-details" className="animated-page fadeIn">
              <ProjectDetails />
            </div>
          } 
        />
      </Routes>
    </div>
  );
}

// 별점 컴포넌트
function StarRating({ projectId, initialRating = 0, onRatingChange }) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [userIp, setUserIp] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [isRatingAllowed, setIsRatingAllowed] = useState(true);

  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(data => {
        setUserIp(data.ip);
        checkRatingEligibility(data.ip);
      })
      .catch(error => {
        console.error('IP를 가져오는 중 오류 발생:', error);
        setUserIp(`fallback-${Math.random().toString(36).substring(2, 15)}`);
      });
  }, [projectId]);

  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prevCooldown => {
          const newCooldown = prevCooldown - 1;
          if (newCooldown <= 0) {
            setIsRatingAllowed(true);
            clearInterval(timer);
            return 0;
          }
          return newCooldown;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [cooldown]);

  const checkRatingEligibility = async (ip) => {
    if (!ip) return;

    try {
      const ipRatingsRef = doc(collection(db, 'ipRatings'), ip);
      const docSnap = await getDoc(ipRatingsRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const projectRating = data[projectId];

        if (projectRating) {
          const lastRatedTime = projectRating.timestamp;
          const currentTime = Date.now();
          const elapsedSeconds = Math.floor((currentTime - lastRatedTime) / 1000);

          if (elapsedSeconds < 60) {
            const remainingSeconds = 60 - elapsedSeconds;
            setCooldown(remainingSeconds);
            setIsRatingAllowed(false);
          } else {
            setIsRatingAllowed(true);
          }
        } else {
          setIsRatingAllowed(true);
        }
      } else {
        setIsRatingAllowed(true);
      }
    } catch (error) {
      console.error('평가 가능 여부 확인 중 오류 발생:', error);
      setIsRatingAllowed(true);
    }
  };

  const handleClick = async (starValue) => {
    if (!userIp) {
      setPopupMessage('IP 정보를 가져오는 중입니다. 잠시 후 다시 시도해주세요.');
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
      return;
    }

    if (!isRatingAllowed) {
      setPopupMessage(`분당 1회만 입력 가능합니다. 남은시간: ${cooldown}초`);
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
      return;
    }

    try {
      setRating(starValue);
      onRatingChange(projectId, starValue);

      const ipRatingsRef = doc(collection(db, 'ipRatings'), userIp);
      const docSnap = await getDoc(ipRatingsRef);

      if (docSnap.exists()) {
        await updateDoc(ipRatingsRef, {
          [projectId]: {
            rating: starValue,
            timestamp: Date.now()
          }
        });
      } else {
        await setDoc(ipRatingsRef, {
          [projectId]: {
            rating: starValue,
            timestamp: Date.now()
          }
        });
      }

      setCooldown(60);
      setIsRatingAllowed(false);

      setPopupMessage('평가가 완료되었습니다!');
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
    } catch (error) {
      console.error('평점 저장 중 오류 발생:', error);
      setPopupMessage('평점 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      setShowPopup(true);
      setTimeout(() => setShowPopup(false), 2000);
    }
  };

  return (
    <div>
      <div className="star-rating">
        {[...Array(5)].map((_, index) => {
          const starValue = index + 1;
          return (
            <span
              key={index}
              className={`star ${starValue <= (hover || rating) ? 'active' : ''}`}
              onClick={() => handleClick(starValue)}
              onMouseEnter={() => setHover(starValue)}
              onMouseLeave={() => setHover(0)}
            >
              ★
            </span>
          );
        })}
      </div>
      {showPopup && (
        <div className="rating-popup">
          {popupMessage}
        </div>
      )}
    </div>
  );
}

// 푸터 컴포넌트
function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-left">
          <div className="footer-brand">
            <span>return Game;</span>
            <div className="social-buttons">
              <a href="https://www.instagram.com/_return_game_" target="_blank" rel="noopener noreferrer">
                <img src="/logo_insta.svg" alt="Instagram" />
              </a>
              <a href="https://github.com/KH-ReturnGame" target="_blank" rel="noopener noreferrer">
                <img src="/logo_github.svg" alt="GitHub" />
              </a>
            </div>
          </div>
          <nav className="footer-nav">
            <Link to="/">홈</Link>
            <Link to="/project">프로젝트</Link>
            <Link to="/introduce">소개</Link>
          </nav>
        </div>
        <div className="footer-right">
          <p className="footer-text">
            사이트 내 <a href="/sources.txt" className="underline-link">일부 외부 자료</a>의 저작권은 해당 원저작자에게 있으며,<br/>
            본 동아리는 이를 교육 및 비영리적 학습 목적으로만 사용하였습니다.<br/>
            Copyright © 2025 return Game, All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

// App
function App() {
  return (
    <Router>
      <ScrollToTop />
      <div className="App">
        {/* <Navbar /> */}
        <AnimatedRoutes />
        {/* <Footer /> */}
      </div>
    </Router>
  );
}

export default App;
