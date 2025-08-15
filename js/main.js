// カレンダーアプリケーションのメインJavaScript

document.addEventListener('DOMContentLoaded', async function() {
    let calendar;
    let eventsData = [];

    // イベントデータを読み込む
    async function loadEvents() {
        try {
            const response = await fetch('data/events.json');
            if (!response.ok) {
                throw new Error('イベントデータの読み込みに失敗しました');
            }
            eventsData = await response.json();
            return eventsData;
        } catch (error) {
            console.error('イベントデータの読み込みエラー:', error);
            return [];
        }
    }

    // FullCalendarを初期化
    function initializeCalendar(events) {
        const calendarEl = document.getElementById('calendar');
        
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'ja',
            firstDay: 1, // 月曜日始まり (0=日曜日, 1=月曜日)
            headerToolbar: false, // デフォルトのヘッダーを非表示
            height: 'auto',
            initialDate: new Date(), // 現在の日付から開始
            validRange: {
                start: '2025-08-01' // 表示開始月
            },
            events: events,
            eventClick: function(info) {
                showEventModal(info.event);
            },
            eventDisplay: 'block',
            eventMaxStack: 4, // v6系で縦積み上限を明示
            dayMaxEvents: 4, // 上限超えたらmore表示
            moreLinkClick: 'popover', // 「他○件」をクリックした時の動作
            eventTimeFormat: {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            },
            // 日本語の曜日名を設定
            dayHeaderFormat: { weekday: 'narrow' },
            // カレンダーの表示設定
            fixedWeekCount: false,
            showNonCurrentDates: false,
            // 月が変わった時のコールバック
            datesSet: function(info) {
                updateCurrentMonthDisplay(info.start);
            }
        });

        calendar.render();
        
        // 初期表示時の月名を設定
        updateCurrentMonthDisplay(calendar.getDate());
    }

    // 現在の月表示を更新
    function updateCurrentMonthDisplay(date) {
        const monthElement = document.getElementById('currentMonth');
        if (monthElement) {
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            monthElement.textContent = `${year}年${month}月`;
        }
    }

    // カスタムナビゲーションボタンの設定
    function setupNavigation() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const todayBtn = document.getElementById('todayBtn');

        prevBtn.addEventListener('click', function() {
            calendar.prev();
            updateCurrentMonthDisplay(calendar.getDate());
        });

        nextBtn.addEventListener('click', function() {
            calendar.next();
            updateCurrentMonthDisplay(calendar.getDate());
        });

        todayBtn.addEventListener('click', function() {
            calendar.today();
            updateCurrentMonthDisplay(calendar.getDate());
        });
    }

    // イベント詳細モーダルを表示
    function showEventModal(event) {
        const modal = document.getElementById('eventModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalDate = document.getElementById('modalDate');
        const modalTime = document.getElementById('modalTime');
        const modalDescription = document.getElementById('modalDescription');
        const modalTags = document.getElementById('modalTags');
        const modalLinkEl = document.getElementById('modalLink');

        // イベント情報を設定
        modalTitle.textContent = event.title;
        
        // 日付の表示
        const startDate = new Date(event.start);
        modalDate.textContent = startDate.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        // 時間の表示
        if (event.allDay) {
            modalTime.textContent = '終日';
        } else {
            const timeFormat = { hour: '2-digit', minute: '2-digit', hour12: false };
            const startTime = startDate.toLocaleTimeString('ja-JP', timeFormat);
            
            if (event.end) {
                const endTime = new Date(event.end).toLocaleTimeString('ja-JP', timeFormat);
                modalTime.textContent = `${startTime} - ${endTime}`;
            } else {
                modalTime.textContent = startTime;
            }
        }

        // 拡張プロパティの表示
        const extendedProps = event.extendedProps || {};
        modalDescription.textContent = extendedProps.description || '説明なし';

        // タグの表示
        modalTags.innerHTML = '';
        if (extendedProps.tags && extendedProps.tags.length > 0) {
            extendedProps.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag';
                tagElement.textContent = tag;
                modalTags.appendChild(tagElement);
            });
        }

        // リンク（あればボタン表示、なければ非表示）
        const link = extendedProps.link || event.url || '';
        if (link) {
            modalLinkEl.href = link;
            modalLinkEl.style.display = 'inline-flex';
        } else {
            modalLinkEl.style.display = 'none';
        }

        // （任意）モーダルのアクセントにイベント色を反映
        const color = event.backgroundColor || extendedProps.color || '';
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent && color) {
            modalContent.style.borderTop = `4px solid ${color}`;
        }

        // モーダルを表示
        modal.style.display = 'block';
    }

    // モーダルを閉じる
    function setupModal() {
        const modal = document.getElementById('eventModal');
        const closeBtn = document.querySelector('.close');

        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
        });

        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // アプリケーションの初期化
    async function initApp() {
        const events = await loadEvents();
        initializeCalendar(events);
        setupNavigation();
        setupModal();
    }

    // アプリケーション開始
    await initApp();
});

