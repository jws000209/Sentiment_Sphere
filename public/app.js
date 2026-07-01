document.addEventListener('DOMContentLoaded', () => {
  const textInput = document.getElementById('text-input');
  const charCount = document.getElementById('char-count');
  const analyzeBtn = document.getElementById('analyze-btn');
  const btnSpinner = analyzeBtn.querySelector('.spinner');
  const btnText = analyzeBtn.querySelector('.btn-text');
  const errorMessage = document.getElementById('error-message');
  
  const sentimentSphere = document.getElementById('sentiment-sphere');
  const resultContainer = document.getElementById('result-container');
  const resultPlaceholder = resultContainer.querySelector('.result-placeholder');
  const resultContent = resultContainer.querySelector('.result-content');
  
  const resultBadge = document.getElementById('result-badge');
  const resultConfidence = document.getElementById('result-confidence');
  const resultProgress = document.getElementById('result-progress');
  const resultReason = document.getElementById('result-reason');
  const historyList = document.getElementById('history-list');
  const backgroundGlow = document.querySelector('.background-glow');

  // 실시간 글자수 계산 및 1000자 초과 제어
  textInput.addEventListener('input', () => {
    const currentLength = textInput.value.length;
    charCount.textContent = currentLength;

    if (currentLength >= 1000) {
      charCount.style.color = '#f87171'; // Red highlight when limit is hit
    } else {
      charCount.style.color = 'var(--text-muted)';
    }
  });

  // 분석 처리 메인 함수
  analyzeBtn.addEventListener('click', async () => {
    const text = textInput.value.trim();

    // 에러 상태 및 UI 초기화
    errorMessage.classList.add('hidden');
    errorMessage.textContent = '';
    
    if (!text) {
      showError('텍스트를 입력해 주세요.');
      return;
    }

    // 로딩 UI 설정
    setLoadingState(true);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '감성 분석 수행 중 서버 오류가 발생했습니다.');
      }

      // 결과 렌더링
      renderResult(data);
      
      // 분석 완료 후 이력(History) 새로고침
      fetchHistory();

    } catch (error) {
      showError(error.message);
    } finally {
      setLoadingState(false);
    }
  });

  // 로딩 상태에 따른 버튼 & UI 비활성화 제어
  function setLoadingState(isLoading) {
    if (isLoading) {
      analyzeBtn.disabled = true;
      btnSpinner.classList.remove('hidden');
      btnText.textContent = '분석 중...';
      errorMessage.classList.add('hidden');
    } else {
      analyzeBtn.disabled = false;
      btnSpinner.classList.add('hidden');
      btnText.textContent = '감성 분석 시작';
    }
  }

  // 에러 노출
  function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
  }

  // 결과 화면 UI 바인딩 및 구체(Sphere) 스타일링 갱신
  function renderResult({ emotion, confidence, reason }) {
    resultPlaceholder.classList.add('hidden');
    resultContent.classList.remove('hidden');

    // 배지 텍스트 및 클래스 초기화
    resultBadge.textContent = emotion;
    resultBadge.className = 'badge'; // reset
    resultProgress.className = 'progress-bar'; // reset

    // Sphere 상태 클래스 초기화
    sentimentSphere.className = 'sphere'; // reset

    // 그라데이션 및 구체 색상 매칭
    if (emotion === '긍정') {
      resultBadge.classList.add('badge-positive');
      resultProgress.classList.add('positive');
      sentimentSphere.classList.add('state-positive');
      backgroundGlow.style.background = 'radial-gradient(circle, rgba(0, 180, 219, 0.15) 0%, rgba(0,0,0,0) 70%)';
    } else if (emotion === '부정') {
      resultBadge.classList.add('badge-negative');
      resultProgress.classList.add('negative');
      sentimentSphere.classList.add('state-negative');
      backgroundGlow.style.background = 'radial-gradient(circle, rgba(248, 87, 166, 0.15) 0%, rgba(0,0,0,0) 70%)';
    } else {
      resultBadge.classList.add('badge-neutral');
      resultProgress.classList.add('neutral');
      sentimentSphere.classList.add('state-neutral');
      backgroundGlow.style.background = 'radial-gradient(circle, rgba(142, 158, 171, 0.15) 0%, rgba(0,0,0,0) 70%)';
    }

    // 신뢰도 프로그레스 바 바인딩
    resultConfidence.textContent = `${confidence}%`;
    resultProgress.style.width = `${confidence}%`;

    // 분석 사유 바인딩
    resultReason.textContent = reason;
    
    // 사유 보더 감성 색상에 맞게 변화
    resultReason.style.borderLeftColor = `var(--${emotion === '긍정' ? 'positive' : emotion === '부정' ? 'negative' : 'neutral'}-color)`;
  }

  // Supabase로부터 최신 이력(10개) 조회
  async function fetchHistory() {
    try {
      const response = await fetch('/api/history');
      if (!response.ok) return;

      const historyData = await response.json();
      renderHistory(historyData);
    } catch (error) {
      console.error('히스토리 로드 에러:', error);
    }
  }

  // 히스토리 리스트 렌더링
  function renderHistory(history) {
    historyList.innerHTML = '';

    if (!history || history.length === 0) {
      historyList.innerHTML = '<div class="no-history">최근 분석 이력이 없습니다.</div>';
      return;
    }

    history.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card';

      // 감성 배지 매핑
      let badgeClass = 'badge-neutral';
      if (item.emotion === '긍정') badgeClass = 'badge-positive';
      else if (item.emotion === '부정') badgeClass = 'badge-negative';

      // 상대 시간 / 단순 날짜 포맷
      const date = new Date(item.created_at);
      const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;

      card.innerHTML = `
        <div class="history-card-header">
          <span class="badge ${badgeClass}">${item.emotion} (${item.confidence}%)</span>
          <span class="time">${dateStr} ${timeStr}</span>
        </div>
        <p class="history-card-text" title="${escapeHtml(item.text)}">${escapeHtml(item.text)}</p>
        <p class="history-card-reason">${escapeHtml(item.reason)}</p>
      `;

      historyList.appendChild(card);
    });
  }

  // HTML 이스케이프 함수 (XSS 방지)
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // 페이지 초기 구동 시 히스토리 로드
  fetchHistory();
});
