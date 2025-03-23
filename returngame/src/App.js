import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, useParams } from 'react-router-dom';
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
  return (
    <div className="page-container">
      <h1>프로젝트 리스트</h1>
      <ul>
        <li>
          <Link to="/project/tetro-mok" className="project-item">
            <div className="project-image-container">
              <img
                src="/unity/tetro-mok/tetro-mok.png"
                alt="Tetro-Mok"
                className="project-image"
              />
            </div>
            <p className="project-text"> Tetro-Mok</p>
          </Link>
        </li>
        <li>
          <Link to="/project/test" className="project-item">
            <div className="project-image-container">
              <img
                src="/unity/test/test.png"
                alt="test"
                className="project-image"
              />
            </div>
            <p className="project-text"> test</p>
          </Link>
        </li>
      </ul>
    </div>
  );
}

function ProjectDetails() {
  const { projectName } = useParams();

  const projectInfo = {
    'tetro-mok': {
      iframeSrc: '/unity/tetro-mok/index.html',
      description: '테트리스와 오목을 결합한 퓨전 보드게임!'
    },
    'test': {
      iframeSrc: '/unity/test/index.html',
      description: 'test'
    }
  };

  const project = projectInfo[projectName];

  if (!project) {
    return <div>프로젝트를 찾을 수 없습니다.</div>;
  }

  const { iframeSrc, description } = project;

  return (
    <div className="page-container">
      <h1>{projectName}</h1>
      <iframe
        src={iframeSrc}
        width="100%"
        height="700"
        frameBorder="0"
        scrolling="no"
        title={projectName}
      />
      <h3>{description}</h3>
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

// 네비게이션 바바
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
        <img src="logo.png" alt="logo" className="logo" />
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