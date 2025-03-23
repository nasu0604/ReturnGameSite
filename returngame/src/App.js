import React, { useState, useEffect } from 'react';
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
// 프로젝트 리스트 페이지
function Project() {
  // Get stored ratings from localStorage
  const [ratings, setRatings] = useState(() => {
    const storedRatings = localStorage.getItem('projectRatings');
    return storedRatings ? JSON.parse(storedRatings) : {};
  });

  // Calculate average rating
  const getAverageRating = (projectId) => {
    // 해당 프로젝트 찾기
    const project = projectsData.find(p => p.id === projectId);
    
    // 사용자 평점이 있는지 확인
    if (ratings[projectId] && ratings[projectId].length > 0) {
      // 사용자 평점이 있으면 평균 계산
      const sum = ratings[projectId].reduce((total, rating) => total + rating, 0);
      return (sum / ratings[projectId].length).toFixed(1);
    } else {
      // 사용자 평점이 없으면 기본 평점 반환 (기본값 0.0)
      return project.rating ? project.rating.toFixed(1) : "0.0";
    }
  };

  return (
    <div className="page-container">
      <h1>프로젝트 리스트</h1>
      <ul>
        {projectsData.map(project => (
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

// ProjectDetails 컴포넌트에 댓글 기능 추가하기
// ProjectDetails 컴포넌트 내에서 평점 및 댓글 창을 하단으로 이동
function ProjectDetails() {
  const { projectName } = useParams();
  const project = projectsData.find(p => p.id === projectName);
  
  // 평점 상태 관리
  const [ratings, setRatings] = useState(() => {
    const storedRatings = localStorage.getItem('projectRatings');
    return storedRatings ? JSON.parse(storedRatings) : {};
  });
  
  // 댓글 시스템 상태 관리
  const [comments, setComments] = useState(() => {
    const storedComments = localStorage.getItem('projectComments');
    return storedComments ? JSON.parse(storedComments) : {};
  });
  
  const [newComment, setNewComment] = useState('');
  const [commentAuthor, setCommentAuthor] = useState('');

  if (!project) {
    return <div>프로젝트를 찾을 수 없습니다.</div>;
  }

  // 평점 변경 처리 함수
  const handleRatingChange = (projectId, newRating) => {
    const updatedRatings = {
      ...ratings,
      [projectId]: [...(ratings[projectId] || []), newRating]
    };
    
    setRatings(updatedRatings);
    localStorage.setItem('projectRatings', JSON.stringify(updatedRatings));
  };

  // 댓글 추가 처리 함수
  const handleAddComment = (e) => {
    e.preventDefault();
    
    if (!newComment.trim()) return;
    
    const author = commentAuthor.trim() || '익명';
    const timestamp = new Date().toISOString();
    
    const newCommentObj = {
      id: Date.now(),
      author,
      text: newComment,
      timestamp
    };
    
    const updatedComments = {
      ...comments,
      [project.id]: [...(comments[project.id] || []), newCommentObj]
    };
    
    setComments(updatedComments);
    localStorage.setItem('projectComments', JSON.stringify(updatedComments));
    
    // 입력 필드 초기화
    setNewComment('');
    setCommentAuthor('');
  };

  // 댓글 삭제 처리 함수
  const handleDeleteComment = (commentId) => {
    if (window.confirm('댓글을 삭제하시겠습니까?')) {
      const updatedComments = {
        ...comments,
        [project.id]: (comments[project.id] || []).filter(comment => comment.id !== commentId)
      };
      
      setComments(updatedComments);
      localStorage.setItem('projectComments', JSON.stringify(updatedComments));
    }
  };

  // 사용자 평점 계산
  const userRating = ratings[project.id] ? 
    ratings[project.id][ratings[project.id].length - 1] : 0;

  return (
    <div className="page-container">
      <h1>{project.name}</h1>
      
      <div className="project-layout">
        {/* 왼쪽 - 게임 설명 */}
        <div className="game-instructions">
          <h2>게임 소개</h2>
          <div className="instruction-box">
            <h3>게임 규칙</h3>
            <p>1. 게임판에 돌을 놓으려면 교차점을 클릭하세요.</p>
            <p>2. 가로, 세로, 또는 대각선으로 5개의 돌을 연속으로 놓는 사람이 승리합니다.</p>
            <p>3. 검은색이 먼저 시작합니다.</p>
            <p>4. 게임 중간에 상대방의 돌을 제거할 수 없습니다.</p>
            <p>5. 모든 교차점에 돌이 놓여도 승자가 없으면 무승부입니다.</p>
          </div>
          
          <div className="game-info">
            <h3>게임 정보</h3>
            <p><strong>장르:</strong> 보드 게임</p>
            <p><strong>난이도:</strong> 초급자 ~ 중급자</p>
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
        </div>

        <div className="ratings-comments-wrapper">
        <div className="ratings-comments">
          <div className="rating-container">
            <h2>평가하기</h2>
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
              {comments[project.id] && comments[project.id].length > 0 ? (
                comments[project.id].map(comment => (
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
                <p className="no-comments">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    
      
    </div>
  );
}


function Introduce() {
  return (
    <div className="page-container">
      <h1>우리는 return Game;입니다</h1>
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

function StarRating({ projectId, initialRating = 0, onRatingChange }) {
  const [rating, setRating] = useState(initialRating);
  const [hover, setHover] = useState(0);
  const [showPopup, setShowPopup] = useState(false);

  const handleClick = (starValue) => {
    setRating(starValue);
    onRatingChange(projectId, starValue);
    setShowPopup(true);
    
    // 3초 후에 팝업을 자동으로 닫고 별점 UI 초기화
    setTimeout(() => {
      setShowPopup(false);
      setRating(0);
      setHover(0);
    }, 1000);
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