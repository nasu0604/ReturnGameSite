import React, { useState, useEffect } from 'react';
import { db, collection, doc, getDoc, setDoc, onSnapshot } from './firebase';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
import projectsData from './projects.json';
import './App.css';

// 메인 페이지
function Home() {
  return (
    <div className="page-container">
      <h1>Hello World!</h1>
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
      <h1>프로젝트 리스트</h1>
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
                  <div className="project-subtitle">test</div>
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


// 텍스트 줄 바꿈 적용 함수
const formatTextWithLineBreaks = (text) => {
  return text.split('\n').map((line, index) => <span key={index}>{line}<br /></span>);
};

// 프로젝트 상세 페이지
function ProjectDetails() {
  // URL 파라미터로 프로젝트 이름 가져오기
  const { projectName } = useParams();
  const project = projectsData.find(p => p.id === projectName);
  
  // 평점 상태 관리
  const [ratings, setRatings] = useState([]);

  useEffect(() => {
    // 최신 Firebase 방식으로 업데이트된 Firestore 구독 메서드
    const projectRatingsRef = doc(collection(db, 'projectRatings'), project.id);
    const unsubscribe = onSnapshot(projectRatingsRef, (doc) => {
      if (doc.exists()) {
        console.log("받은 평점 데이터:", doc.data().ratings);
        setRatings(doc.data().ratings || []);
      } else {
        setRatings([]);
      }
    });
    return () => unsubscribe();
  }, [project.id]);

  const getAverageRating = () => {
    if (ratings.length === 0) {
      // 평점이 없는 경우 프로젝트의 기본 평점 반환
      return project.rating ? project.rating.toFixed(1) : "0.0";
    }
    
    // 현재 평점들의 평균 계산
    const averageRating = ratings.reduce((acc, cur) => acc + cur, 0) / ratings.length;
    return averageRating.toFixed(1);
  };
  
  // 댓글 시스템 상태 관리
  const [comments, setComments] = useState([]);

  useEffect(() => {
    // 최신 Firebase 방식으로 업데이트된 Firestore 구독 메서드
    const projectCommentsRef = doc(collection(db, 'projectComments'), project.id);
    const unsubscribe = onSnapshot(projectCommentsRef, (doc) => {
      if (doc.exists()) {
        setComments(doc.data().comments || []);
      } else {
        setComments([]);
      }
    });
    return () => unsubscribe();
  }, [project.id]);
  
  // 댓글 입력 필드 상태 관리
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');

  if (!project) {
    return <div>프로젝트를 찾을 수 없습니다.</div>;
  }

  // 평점 변경 처리 함수
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
      console.error("Error updating rating: ", error);
    }
  };

  // 댓글 추가 처리 함수
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const author = commentAuthor.trim() || '익명';
    const timestamp = new Date().toISOString();

    const newCommentObj = {
      id: Date.now(),
      author,
      text: newComment,
      timestamp,
    };

    const projectCommentsRef = doc(collection(db, 'projectComments'), project.id);
    
    try {
      const docSnap = await getDoc(projectCommentsRef);
      let updatedComments = [];
      
      if (docSnap.exists()) {
        updatedComments = [...(docSnap.data().comments || []), newCommentObj];
      } else {
        updatedComments = [newCommentObj];
      }
      
      await setDoc(projectCommentsRef, { comments: updatedComments });

      // 입력 필드 초기화
      setNewComment('');
      setCommentAuthor('');
    } catch (error) {
      console.error("Error adding comment: ", error);
    }
  };

  // 댓글 삭제 처리 함수
  const handleDeleteComment = async (commentId) => {
    if (window.confirm('댓글을 삭제하시겠습니까?')) {
      const projectCommentsRef = doc(collection(db, 'projectComments'), project.id);
      
      try {
        const docSnap = await getDoc(projectCommentsRef);
        if (docSnap.exists()) {
          const updatedComments = (docSnap.data().comments || [])
            .filter(comment => comment.id !== commentId);
          
          await setDoc(projectCommentsRef, { comments: updatedComments });
        }
      } catch (error) {
        console.error("Error deleting comment: ", error);
      }
    }
  };

  // 사용자 평점 계산
  const userRating = ratings.length > 0 ? ratings[ratings.length - 1] : 0;
  
  // 프로젝트 상세 페이지 UI
  return (
    <div className="page-container">
      <h1>{project.name}</h1>
      
      <div className="project-layout">
        {/* 왼쪽 - 게임 설명 */}
        <div className="game-instructions">
          <div className="instruction-box">
            <h2>게임 방법</h2>
            <p>{formatTextWithLineBreaks(project.how)}</p>
          </div>
          
          <div className="game-info">
            <h2>게임 정보</h2>
            <p><strong>장르:</strong> {project.concept}</p>
            <p><strong>난이도:</strong> {project.difficulty}</p>
            <p><strong>개발자:</strong> return Game;</p>
            <p><strong>버전:</strong> 1.0</p>
          </div>
        </div>
        
        {/* 중앙 - 게임 화면 */}
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
      
      {/* 오른쪽 - 평점 및 댓글 화면 */}
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
                <div className="input-group">
                  <input
                    type="text"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder="이름 (선택사항)"
                    className="author-input"
                  />
                </div>
                <div className="input-group">
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="댓글을 입력하세요..."
                    className="comment-input"
                    required
                  />
                </div>
                <button type="submit" className="comment-submit-btn">댓글 작성</button>
              </form>
              
              {/* 댓글 리스트 */}
              <div className="comments-list">
                {comments.length > 0 ? (
                  comments.map(comment => (
                    <div key={comment.id} className="comment-item">
                      <div className="comment-header">
                        <strong>{comment.author}</strong>
                        <span className="comment-date">
                          {new Date(comment.timestamp).toLocaleDateString()} 
                          {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                  <p className="no-comments">아직 댓글이 없습니다.<br/> 첫 댓글을 남겨보세요!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 소개 페이지
function Introduce() {
  // 소개 페이지 UI
  return (
    <div className="page-container">
      <h1>우리는 return Game;입니다</h1>
    </div>
  );
}

// 네비게이션 바
function Navbar() {
  // 현재 활성화된 탭 상태 관리
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('/');

  // 현재 경로에 따라 활성화된 탭 설정
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

  // 네비게이션 바 UI
  return (
    <nav className="navbar">
      <div className="navbar-title">
        <img src="/logo.png" alt="logo" className="logo" />
      </div>
      <div className="navbar-links">
        <Link
          to="/"
          className={`nav-link ${activeTab === '/' ? 'active' : ''}`}
        >
          홈
        </Link>
        <Link
          to="/project"
          className={`nav-link ${activeTab === '/project' ? 'active' : ''}`}
        >
          프로젝트
        </Link>
        <Link
          to="/introduce"
          className={`nav-link ${activeTab === '/introduce' ? 'active' : ''}`}
        >
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

  // 🔄 props로 받은 초기값이 바뀌면 상태에 반영 (예: Firestore 업데이트 시)
  useEffect(() => {
    setRating(initialRating);
  }, [initialRating]);

  // ⭐ 별 클릭 이벤트
  const handleClick = (starValue) => {
    setRating(starValue); // 바로 화면에 반영
    onRatingChange(projectId, starValue); // 외부로 전달 (Firestore 저장)
    setShowPopup(true); // 팝업 보여주기

    // 1초 후 팝업만 닫기 (별점은 유지)
    setTimeout(() => {
      setShowPopup(false);
    }, 1000);
  };

  // ⭐ 별 UI 렌더링
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