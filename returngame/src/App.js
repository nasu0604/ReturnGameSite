import React, { useState, useEffect, useRef } from 'react';
import { db, collection, doc, getDoc, setDoc, onSnapshot } from './firebase';
import { updateDoc, arrayUnion } from 'firebase/firestore';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import projectsData from './projects.json';
import timelineData from './timelineData.json';
import './App.css';


// 사진 모달 컴포넌트
function PhotoModal({ photos, currentIndex, onClose, onPrev, onNext }) {
  if (!photos || photos.length === 0) return null;
  return (
    <div className="photo-modal-overlay">
      <div className="photo-modal">
        <button className="close-button" onClick={onClose}>×</button>
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

const AdFitBanner = ({
  // 데스크탑 기본값
  adUnit = "DAN-cbhNH2DQGsz5BG5u",
  width  = 728,
  height = 90,
  // 모바일 기본값
  mobileAdUnit = "DAN-5HHAjw0y2pRiS3R9",
  mobileWidth  = 320,
  mobileHeight = 100
}) => {
  const ref = useRef(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    // 1) 컨테이너 초기화
    container.innerHTML = '';

    // 2) 화면 크기에 따라 사용할 유닛/크기 선택
    const isMobile = window.innerWidth <= 768;
    const unit   = isMobile ? mobileAdUnit : adUnit;
    const w      = isMobile ? mobileWidth  : width;
    const h      = isMobile ? mobileHeight : height;

    // 3) ins 요소 생성
    const ins = document.createElement('ins');
    ins.className = 'kakao_ad_area';
    ins.style.display = 'none';            // SDK가 로드되면 show 처리
    ins.setAttribute('data-ad-unit',   unit);
    ins.setAttribute('data-ad-width',  String(w));
    ins.setAttribute('data-ad-height', String(h));
    container.appendChild(ins);

    // 4) 스크립트 로드
    const script = document.createElement('script');
    script.src   = '//t1.daumcdn.net/kas/static/ba.min.js';
    script.async = true;
    container.appendChild(script);

    // 5) 언마운트 시 정리
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



// 줄바꿈 함수
const formatTextWithLineBreaks = (text) => {
  const regex = /(\{[^}]+\})/g;
  return text.split(regex).map((segment, index) => {
    if (regex.test(segment)) {
      return <span key={index} className="gray-text">{segment}</span>;
    }
    const lines = segment.split('\n');
    return (
      <span key={index}>
        {lines.map((line, i) => (
          <React.Fragment key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </React.Fragment>
        ))}
      </span>
    );
  });
};

// 메인 페이지
function Home() {
  return (
    <div className="page-container">
      <h1>@return Game;</h1>
      <h5>경희고등학교 게임 개발 동아리</h5>
      <div className="home-links">
        <a 
          href="https://www.instagram.com/_return_game_" 
          className="home-link-box" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          동아리 인스타그램
        </a>
        <Link to="/project" className="home-link-box">
          프로젝트 둘러보기
        </Link>
        <Link to="/introduce" className="home-link-box">
          동아리 연혁 보기
        </Link>
      </div>
      <AdFitBanner />
    </div>
  );
}

// 프로젝트 리스트 페이지
function Project() {
  const [ratings, setRatings] = useState({});

  // Firestore에서 각 프로젝트의 평점 데이터를 실시간 구독
  useEffect(() => {
    const unsubscribes = projectsData.map((project) => {
      const projectRef = doc(collection(db, 'projectRatings'), project.id);
      return onSnapshot(projectRef, (docSnap) => {
        if (docSnap.exists()) {
          setRatings((prev) => ({
            ...prev,
            [project.id]: docSnap.data().ratings || [],
          }));
        } else {
          setRatings((prev) => ({
            ...prev,
            [project.id]: [],
          }));
        }
      });
    });

    // 컴포넌트 언마운트 시 구독 해제
    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  // 평균 평점 계산 함수
  const getAverageRating = (projectId) => {
    const project = projectsData.find((p) => p.id === projectId);
    const projectRatings = ratings[projectId] || [];

    if (projectRatings.length > 0) {
      const averageRating =
        projectRatings.reduce((total, rating) => total + rating, 0) / projectRatings.length;
      return averageRating.toFixed(1);
    } else {
      return project.rating ? project.rating.toFixed(1) : '0.0';
    }
  };

  // UI 렌더링
  return (
    <div className="page-container">
      <ul>
        {projectsData.map((project) => (
          <li key={project.id}>
            <Link to={`/project/${project.id}`} className="project-item">
              <div className="project-image-container">
                <img
                  src={project.imagePath}
                  alt={project.name}
                  className="project-image"
                />
              </div>
              <div className="project-text-container">
                <div className="project-text-row">
                  <div className="project-title">{project.name}</div>
                  <div className="project-rating">★ {getAverageRating(project.id)}</div>
                </div>
                <div className="project-text-row">
                  <div className="project-subtitle">{project.main_desc}</div>
                  <div className="project-concept">{project.concept}</div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// 프로젝트 상세 페이지
function ProjectDetails() {
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

  // 가장 최근 평점을 사용자 평점으로 표시
  const userRating = ratings.length > 0 ? ratings[ratings.length - 1] : 0;

  // 프로젝트 상세 페이지 UI
  return (
    <div className="page-container project-details-page">  
      <div className="project-layout">
        {/* 왼쪽: 게임 방법 및 게임 정보 */}
        <div className="game-instructions">
          <div className="instruction-box">
            <h2>게임 방법</h2>
            <p>{formatTextWithLineBreaks(project.how)}</p>
          </div>
          <div className="game-info">
            <h2>게임 정보</h2>
            <p>
              <strong>장르:</strong> {project.concept}
            </p>
            <p>
              <strong>난이도:</strong>
              {[...Array(5)].map((_, index) => (
                <span key={index} style={{ marginLeft: '5px' }}>
                  {index < project.difficulty ? '★' : '☆'}
                </span>
              ))}
            </p>
            <p>
              <strong>개발자:</strong> {project.developer}
            </p>
            <p>
              <strong>개발연도:</strong> {project.date}
            </p>
          </div>
        </div>

        {/* 중앙: 게임 플레이 */}
        <div className="game-container">
          <div className="game-frame-wrapper">
            <iframe
              src={project.iframeSrc}
              frameBorder="0"
              scrolling="no"
              title={project.name}
              className="game-iframe"
            />
          </div>
          <p className="game-description">{project.description}</p>
        </div>

        {/* 오른쪽: 평점 및 댓글 */}
        <div className="ratings-comments-wrapper">
          <div className="ratings-comments">
            <div className="rating-container">
              <h2>평가</h2>
              <StarRating
                projectId={project.id}
                initialRating={userRating}
                onRatingChange={handleRatingChange}
              />
            </div>

            <div className="comments-section">
              <h2>댓글</h2>
              {/* 댓글 입력 폼 */}
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
                    placeholder="댓글을 입력하세요..."
                    className="comment-input"
                    required
                  />
                </div>

                <button type="submit" className="comment-submit-btn">
                  댓글 작성
                </button>
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
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="comment-text">{comment.text}</p>
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
      <AdFitBanner />
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
  // 페이지 전환 시 애니메이션 효과
  const location = useLocation();
  
  // 페이지 전환 애니메이션
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
  // 별점 상태 관리
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [showPopup, setShowPopup] = useState(false);

  // 받은 초기값이 바뀌면 상태 반영
  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  // 별 클릭 이벤트
  const handleClick = (starValue) => {
    setRating(starValue);
    onRatingChange(projectId, starValue); // firestore에 저장
    setShowPopup(true);

    // 1초 후 팝업 닫기
    setTimeout(() => {
      setShowPopup(false);
    }, 1000);
  };

  // 평점 UI
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
          평가가 완료되었습니다!
        </div>
      )}
    </div>
  );
}

// App
function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <AnimatedRoutes />
      </div>
    </Router>
  );
}

export default App;