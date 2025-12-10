"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
// Firebase 관련 기능 불러오기
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  serverTimestamp 
} from "firebase/firestore";
// 아이콘 불러오기 (설치가 안되어 있다면 'npm install lucide-react' 필요)
import { LogOut, User, Menu, X, ExternalLink, Activity, Info, AlertTriangle } from "lucide-react";

// === 1. 설정 및 타입 정의 ===

// 캔버스(웹) 환경에서 제공하는 환경변수 사용. 
// 로컬 개발 환경(내 컴퓨터)이나 CI/CD 환경(Git Actions)에서는 process.env를 사용합니다.
const appId = typeof __app_id !== 'undefined' ? __app_id : 'daily-stock-brief';

// Firebase 설정 객체를 가져오는 함수. Canvas 환경 우선, 없으면 process.env 사용
const getFirebaseConfig = () => {
  // 1. Canvas 전역 변수가 정의되어 있으면 이를 사용 (우선 순위 1)
  if (typeof __firebase_config !== 'undefined') {
    try {
      return JSON.parse(__firebase_config);
    } catch (e) {
      console.error("Canvas Firebase Config Parsing Error:", e);
      return {};
    }
  }

  // 2. process.env에서 설정값들을 가져와 객체를 구성 (Git Actions, Local 등)
  if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
    };
  }

  // 3. 둘 다 없으면 빈 객체 반환
  return {};
};

const firebaseConfig = getFirebaseConfig();

const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// n8n 주소 (사용자님이 나중에 n8n 설정 후 변경해야 할 주소)
const N8N_KAKAO_AUTH_URL = "https://your-n8n-instance/webhook/kakao-firebase-auth";

// 데이터 타입 정의
type GainerItem = {
  name: string;
  code: string;
  price: string;
  change: string;
  reason: string;
  trading_value?: string;
  market_cap?: string;
  listed_shares?: string;
};

type GainerData = {
  title: string;
  url: string;
  date: string;
  items: GainerItem[];
}[];

type ThemeData = {
  title: string;
  url: string;
  date: string;
  body: string;
}[];

// === 2. Firebase 초기화 ===
let app;
let auth;
let db;

// 설정값이 있을 때만 Firebase를 시작합니다.
if (Object.keys(firebaseConfig).length > 0) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (e) {
    console.error("Firebase 초기화 에러:", e);
  }
}

const googleProvider = new GoogleAuthProvider();

// === 3. 메인 페이지 컴포넌트 ===
export default function Home() {
  // --- 기존 데이터 상태 ---
  const [gainers, setGainers] = useState<GainerData>([]);
  const [themes, setThemes] = useState<ThemeData>([]);
  const [dateFolder, setDateFolder] = useState<string>("");
  const [expandedChart, setExpandedChart] = useState<Record<string, boolean>>({});

  // --- 새로 추가된 인증(로그인) 상태 ---
  const [user, setUser] = useState<any>(null); // 로그인한 사용자 정보
  const [isAuthReady, setIsAuthReady] = useState(false); // Firebase 준비 여부
  const [isSigningIn, setIsSigningIn] = useState(false); // 로그인 진행 중 표시
  const [authError, setAuthError] = useState<string | null>(null); // 에러 메시지
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // 모바일 메뉴 열림/닫힘

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // ---------------------------
  // [A] Firebase 인증 로직
  // ---------------------------
  useEffect(() => {
    if (!auth || !db) {
      console.warn("Firebase 설정이 올바르지 않아 인증 기능을 건너뜁니다.");
      return;
    }

    // 1. 로그인 상태 변화 감지 (로그인/로그아웃 할 때마다 실행됨)
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // 로그인 성공 시 Firestore에 사용자 정보 저장 (나중 결제 기능을 위한 준비)
        try {
          const userRef = doc(db, "artifacts", appId, "users", currentUser.uid);
          await setDoc(userRef, {
            email: currentUser.email,
            displayName: currentUser.displayName,
            photoURL: currentUser.photoURL,
            lastSignInTime: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.error("사용자 정보 저장 실패:", e);
        }
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });

    // 2. 초기 자동 로그인 (앱 처음 켤 때)
    const signInOnLoad = async () => {
        try {
          if (initialAuthToken) {
            await signInWithCustomToken(auth, initialAuthToken);
          } else {
            // 토큰이 없으면 익명 로그인 시도 (데이터는 보여줘야 하니까)
            await signInAnonymously(auth);
          }
        } catch (error) {
          console.error("초기 로그인 실패:", error);
        }
    };

    if (!isAuthReady) {
        signInOnLoad();
    }

    return () => unsubscribe();
  }, []);

  // [구글 로그인]
  const handleGoogleSignIn = async () => {
    if (!auth) return;
    setAuthError(null);
    setIsSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google 로그인 에러:", error);
      setAuthError("Google 로그인 실패: " + error.message);
    } finally {
      setIsSigningIn(false);
    }
  };

  // [카카오 로그인 (n8n 연동)]
  const handleKakaoSignIn = async () => {
    if (!auth) return;
    setAuthError(null);
    setIsSigningIn(true);
    setAuthError("카카오 로그인 서버(n8n)와 통신 중..."); // 진행 상황 표시

    try {
      // n8n에 요청 보내기 (실제 n8n이 준비되어야 작동합니다)
      const response = await fetch(N8N_KAKAO_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request_custom_token' })
      });

      if (!response.ok) throw new Error("서버 통신 실패");

      const { firebaseCustomToken } = await response.json();
      if (!firebaseCustomToken) throw new Error("토큰 없음");

      // 받아온 토큰으로 로그인
      await signInWithCustomToken(auth, firebaseCustomToken);
      setAuthError("카카오 로그인 성공!");
      
    } catch (error: any) {
      console.error("Kakao 로그인 에러:", error);
      setAuthError("카카오 로그인 실패 (n8n 설정을 확인하세요)");
    } finally {
      setIsSigningIn(false);
    }
  };

  // [로그아웃]
  const handleSignOut = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      await signInAnonymously(auth); // 로그아웃 해도 데이터는 보이게 익명 전환
      window.location.reload(); // 깔끔하게 새로고침
    } catch (error) {
      console.error("로그아웃 에러:", error);
    }
  };


  // ---------------------------
  // [B] 데이터 가져오기 로직 (기존 코드 유지)
  // ---------------------------
  
  // 1. 날짜 확인
  useEffect(() => {
    const fetchLatestDate = async () => {
      try {
        const res = await fetch("/data/index.json");
        if (!res.ok) return;
        const idx = await res.json();
        setDateFolder(idx.latestDate);
      } catch {}
    };
    fetchLatestDate();
  }, []);

  // 2. 데이터 로드 (최대 14일 전까지 탐색)
  useEffect(() => {
    if (!dateFolder) return;

    const fetchData = async () => {
      let attempts = 14;
      let folder = dateFolder;
      while (attempts > 0) {
        try {
          const gainersRes = await fetch(`/data/${folder}/infostock_gainers.json`);
          const themesRes = await fetch(`/data/${folder}/infostock_themes.json`);

          if (gainersRes.ok || themesRes.ok) {
            if (gainersRes.ok) setGainers(await gainersRes.json());
            if (themesRes.ok) setThemes(await themesRes.json());
            setDateFolder(folder);
            return;
          }
        } catch {}
        const [y, m, d] = folder.split("-").map(Number);
        const prev = new Date(y, m - 1, d - 1);
        folder = prev.toISOString().slice(0, 10);
        attempts--;
      }
    };
    fetchData();
  }, [dateFolder]);

  // ---------------------------
  // [C] UI 렌더링
  // ---------------------------

  const toggleChart = (code: string) => {
    setExpandedChart((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  // 로그인 버튼 UI 그리기 함수
  const renderAuthButtons = () => {
    if (!isAuthReady) return <span className="text-xs text-gray-400">로딩중...</span>;

    // 로그인 된 상태 (익명이 아님)
    if (user && !user.isAnonymous) {
      return (
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 bg-gray-100 rounded-full px-3 py-1">
            {user.photoURL ? (
              <img src={user.photoURL} alt="프사" className="w-6 h-6 rounded-full" />
            ) : (
              <User className="w-5 h-5 text-gray-500" />
            )}
            <span className="text-sm font-medium text-gray-700">{user.displayName || "회원님"}</span>
          </div>
          <button onClick={handleSignOut} className="text-sm text-red-500 hover:text-red-700 font-medium">
            로그아웃
          </button>
        </div>
      );
    } 
    
    // 로그인 안 된 상태 (또는 익명)
    return (
      <div className="flex flex-col md:flex-row gap-2">
        <button
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
          className="flex items-center justify-center space-x-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          {isSigningIn ? <Activity className="w-4 h-4 animate-spin"/> : <span className="text-blue-600 font-bold">G</span>}
          <span>구글 로그인</span>
        </button>
        <button
          onClick={handleKakaoSignIn}
          disabled={isSigningIn}
          className="flex items-center justify-center space-x-1 px-3 py-2 bg-[#FEE500] rounded-lg text-sm hover:bg-[#FDD835] transition"
        >
          {isSigningIn ? <Activity className="w-4 h-4 animate-spin"/> : <span className="font-bold text-black">K</span>}
          <span className="text-black">카카오 로그인</span>
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 1. 상단 헤더바 (신규 추가) */}
      <header className="sticky top-0 bg-white border-b z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">데일리 주식 브리핑</h1>
          
          {/* PC용 버튼 */}
          <div className="hidden md:block">
            {renderAuthButtons()}
          </div>

          {/* 모바일용 메뉴 버튼 */}
          <button className="md:hidden p-2" onClick={toggleMobileMenu}>
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* 모바일 메뉴 드롭다운 */}
        {isMobileMenuOpen && (
          <div className="md:hidden p-4 bg-gray-50 border-t">
            {renderAuthButtons()}
          </div>
        )}
      </header>

      {/* 2. 에러 메시지 표시줄 */}
      {authError && (
        <div className="bg-red-100 text-red-700 p-3 text-center text-sm font-medium">
          <AlertTriangle className="inline w-4 h-4 mr-1 mb-1"/> {authError}
        </div>
      )}

      {/* 3. 메인 컨텐츠 (기존 코드 디자인 유지) */}
      <main className="p-6 max-w-6xl mx-auto">
        {/* 업데이트 안내 */}
        <div className="flex flex-col md:flex-row justify-center items-center text-center text-sm text-gray-400 mb-6 space-y-1 md:space-y-0 md:space-x-4">
          <div className="flex items-center"><Info className="w-4 h-4 mr-1"/>장마감 후 오후 5시 45분~6시 사이 업데이트됩니다</div>
          <span className="hidden md:inline">|</span>
          <span>Contact: enomme@naver.com</span>
        </div>

        <h1 className="text-3xl font-bold text-center mb-8">
          📅 {dateFolder || "로딩중..."} 장 마감 브리핑
        </h1>

        {/* 상한가/급등주 리스트 */}
        <h2 className="text-2xl font-bold mb-6 flex items-center">
          📈 상한가 및 급등주
        </h2>
        
        {gainers.length === 0 || !gainers[0].items.length ? (
          <p className="text-gray-500 text-center py-10 border rounded-lg">데이터가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gainers[0].items.map((item, i) => (
              <div key={`${item.code}-${i}`} className="border p-5 rounded-xl shadow-sm hover:shadow-md transition bg-white">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold">
                    {item.name} <span className="text-sm text-gray-400 font-normal">({item.code})</span>
                  </h2>
                  <span className={`text-sm font-bold ${item.change.includes('+') ? 'text-red-500' : 'text-blue-500'}`}>
                    {item.price} {item.change}
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 mt-2 min-h-[40px]">{item.reason}</p>

                {/* 추가 정보가 있다면 표시 */}
                {(item.trading_value || item.market_cap) && (
                   <div className="mt-3 p-2 bg-gray-50 rounded text-xs text-gray-500 space-y-1">
                      {item.market_cap && <p>시가총액: {item.market_cap}</p>}
                      {item.trading_value && <p>거래대금: {item.trading_value}</p>}
                   </div>
                )}

                <div className="flex gap-2 mt-4 flex-wrap">
                  <a
                    href={`https://finance.naver.com/item/main.naver?code=${item.code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center bg-green-500 text-white px-3 py-1.5 rounded-md text-xs hover:bg-green-600 transition"
                  >
                    네이버 금융 <ExternalLink className="w-3 h-3 ml-1"/>
                  </a>

                  {!isMobile && (
                    <button
                      onClick={() => toggleChart(item.code)}
                      className="bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs hover:bg-blue-600 transition"
                    >
                      {expandedChart[item.code] ? "차트 닫기" : "차트 보기"}
                    </button>
                  )}
                </div>

                {!isMobile && expandedChart[item.code] && (
                  <div className="mt-4 w-full overflow-hidden border rounded-lg shadow-inner bg-gray-50">
                    <iframe
                      src={`https://finance.naver.com/item/fchart.naver?code=${item.code}`}
                      width="100%"
                      height="400"
                      frameBorder="0"
                      scrolling="no"
                      className="w-full h-[400px]"
                    />
                  </div>
                )}

                {isMobile && (
                  <p className="text-xs text-gray-400 mt-2 text-right">
                    * 차트는 PC에서 확인 가능
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 특징 테마 */}
        <h2 className="text-2xl font-bold mt-12 mb-4">📝 특징 테마</h2>
        {themes.length === 0 || !themes[0].body ? (
          <p className="text-gray-500 text-center py-10 border rounded-lg">데이터가 없습니다.</p>
        ) : (
          <div className="bg-gray-50 p-6 rounded-xl shadow-inner border">
            <p className="whitespace-pre-line text-sm leading-7 text-gray-700">{themes[0].body}</p>
          </div>
        )}
      </main>
      
      {/* 하단 푸터 */}
      <footer className="mt-12 border-t py-8 text-center">
        <p className="text-xs text-gray-400">© 2025 Daily Stock Briefing.</p>
      </footer>
    </div>
  );
}