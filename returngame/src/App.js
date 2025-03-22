import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

// 메인 페이지
function Home() {
  return (
    <div className="page-container">
      <h1>Hello World!</h1>
    </div>
  );
}

// 프로젝트 페이지
function Project() {
  return (
    <div className="page-container">
      <h1>Tetro-Mok</h1>
      <iframe
        src="/unity/index.html"
        width="100%"
        height="600"
        frameBorder="0"
        scrolling="no"
        title="Tetro-Mok"
      />
    </div>
  );
}

// 소개 페이지
function Introduce() {
  return (
    <div className="page-container">
      <h1>우리는 return Game;입니다</h1>
    </div>
  );
}

// 상단 네비게이션 바
function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-title">return Game;</div>
      <div className="navbar-links">
        <Link to="/" className="nav-link">홈</Link>
        <Link to="/project" className="nav-link">프로젝트</Link>
        <Link to="/introduce" className="nav-link">소개</Link>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <div className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/project" element={<Project />} />
            <Route path="/introduce" element={<Introduce />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}


export default App;