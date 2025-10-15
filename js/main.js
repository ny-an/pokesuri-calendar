// カレンダーアプリケーションのメインJavaScript

document.addEventListener('DOMContentLoaded', async function() {
    let calendar;
    let eventsData = [];

    // イベントデータを読み込む
    async function loadEvents() {
        try {
            const filesRes = await fetch('data/eventFiles.json');
            if (!filesRes.ok) throw new Error('ファイルリストの取得に失敗');
            const eventFiles = await filesRes.json();

            const fetches = eventFiles.map(file =>
              fetch(file).then(res => {
                  if (!res.ok) throw new Error(file + 'の読み込みに失敗');
                  return res.json();
              })
            );
            const multipleEvents = await Promise.all(fetches);
            const events = multipleEvents.flatMap(ev => Array.isArray(ev) ? ev : [ev]);
            
            // 日付形式を修正（曜日を削除してFullCalendarが解析できる形式に）
            const processedEvents = events.map(event => {
                if (event.start && event.start.includes(' (')) {
                    event.start = event.start.split(' (')[0];
                }
                if (event.end && event.end.includes(' (')) {
                    event.end = event.end.split(' (')[0];
                }
                return event;
            });
            
            return processedEvents;
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
            showNonCurrentDates: true,
            // 月が変わった時のコールバック
            datesSet: function(info) {
                updateCurrentMonthDisplay(info.start);
            },
            eventDidMount:function(info) {
                // カレンダーバー色の上書き処理
                // console.log("event id:" + info.event.id,info);

                // color2 があれば上書き
                if (info.event.extendedProps && info.event.extendedProps.color2) {
                    // a.fc-event自体に背景色を上書き
                    info.el.style.background = info.event.extendedProps.color2;
                    console.log("exist color2:" + info.event.extendedProps.color2);
                }

            },
            eventContent: function(arg) {
              // デフォルトだとarg.timeTextに時刻（例"15:00"）が入る
              // 時刻を消してタイトルだけ表示したい場合
              return { html: `<div class="fc-event-title">${arg.event.title}</div>` };
            },

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
                modalTime.textContent = `${startTime} 〜 ${endTime}`;
            } else {
                modalTime.textContent = startTime + "〜";
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

    // フィルター機能の設定
    function setupFilters() {
        const filterBtn = document.getElementById('filterBtn');
        const filterPopup = document.getElementById('filterPopup');
        const filterCloseBtn = document.getElementById('filterCloseBtn');
        const filterPopupButtons = document.querySelectorAll('.filter-popup-btn');
        let currentFilter = 'all';

        // フィルターボタンのクリック
        if (filterBtn) {
            filterBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                const isVisible = filterPopup.style.display === 'block';
                filterPopup.style.display = isVisible ? 'none' : 'block';
            });
        }

        // フィルターポップアップを閉じる
        if (filterCloseBtn) {
            filterCloseBtn.addEventListener('click', function() {
                filterPopup.style.display = 'none';
            });
        }

        // フィルターボタンのクリック
        filterPopupButtons.forEach(button => {
            button.addEventListener('click', function() {
                // アクティブ状態を更新
                filterPopupButtons.forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                
                currentFilter = this.getAttribute('data-filter');
                filterEvents(currentFilter);
                
                // ポップアップを閉じる
                filterPopup.style.display = 'none';
            });
        });

        // ポップアップ外クリックで閉じる
        document.addEventListener('click', function(event) {
            if (filterPopup && !filterBtn.contains(event.target) && !filterPopup.contains(event.target)) {
                filterPopup.style.display = 'none';
            }
        });
    }

    // イベントのフィルタリング
    function filterEvents(filterType) {
        if (!calendar) return;

        const allEvents = calendar.getEvents();
        
        allEvents.forEach(event => {
            const tags = event.extendedProps?.tags || [];
            let shouldShow = false;

            switch (filterType) {
                case 'all':
                    shouldShow = true;
                    break;
                case 'new-pokemon':
                    shouldShow = tags.includes('新ポケモン') || tags.includes('新フィールド');
                    break;
                case 'events':
                    shouldShow = (tags.includes('イベント') || tags.includes('キャンペーン'));
                    break;
                case 'regular':
                    shouldShow = tags.includes('NMD') || tags.includes('GSD');
                    break;
            }

            // イベントの表示/非表示を制御
            if (shouldShow) {
                // 表示する場合：元のスタイルを復元
                const originalColor = event.extendedProps?.color || event.backgroundColor || '#5a9b8e';
                event.setProp('backgroundColor', originalColor);
                event.setProp('borderColor', originalColor);
                event.setProp('textColor', '#ffffff');
                event.setProp('classNames', []);
            } else {
                // 非表示にする場合：透明にしてクリック不可にする
                event.setProp('backgroundColor', 'transparent');
                event.setProp('borderColor', 'transparent');
                event.setProp('textColor', 'transparent');
                event.setProp('classNames', ['hidden-event']);
            }
        });
    }

    // イベント一覧の設定
    function setupEventList() {
        const eventListBtn = document.getElementById('eventListBtn');
        const eventListModal = document.getElementById('eventListModal');
        const eventListCloseBtn = eventListModal.querySelector('.close');
        const searchInput = document.getElementById('eventSearchInput');
        const sortRadios = document.querySelectorAll('input[name="sortOrder"]');

        // イベント一覧ボタンのクリック
        eventListBtn.addEventListener('click', function() {
            showEventList();
        });

        // モーダルを閉じる
        eventListCloseBtn.addEventListener('click', function() {
            eventListModal.style.display = 'none';
        });

        // 検索入力の即時フィルター
        searchInput.addEventListener('input', function() {
            filterEventList();
        });

        // 絞り込みボタンのクリック
        const filterToggleBtn = document.getElementById('filterToggleBtn');
        const eventTypeFilter = document.getElementById('eventTypeFilter');
        
        if (filterToggleBtn && eventTypeFilter) {
            filterToggleBtn.addEventListener('click', function() {
                const isVisible = eventTypeFilter.style.display !== 'none';
                eventTypeFilter.style.display = isVisible ? 'none' : 'block';
                filterToggleBtn.classList.toggle('active', !isVisible);
            });
        }

        // イベント種類フィルターの変更
        const eventTypeRadios = document.querySelectorAll('input[name="eventTypeFilter"]');
        eventTypeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                generateEventList();
            });
        });

        // モーダル外クリックで閉じる
        window.addEventListener('click', function(event) {
            if (event.target === eventListModal) {
                eventListModal.style.display = 'none';
            }
        });
    }

    // イベント一覧を表示
    function showEventList() {
        const eventListModal = document.getElementById('eventListModal');
        const eventListContent = document.getElementById('eventListContent');
        
        // イベント一覧を生成
        generateEventList();
        
        // モーダルを表示
        eventListModal.style.display = 'block';
    }

    // イベント一覧を生成
    function generateEventList() {
        const eventListContent = document.getElementById('eventListContent');
        const allEvents = calendar.getEvents();
        
        // イベントを配列に変換
        const eventsArray = allEvents.map(event => ({
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            allDay: event.allDay,
            description: event.extendedProps?.description || '',
            tags: event.extendedProps?.tags || [],
            link: event.extendedProps?.link || event.url || '',
            color: event.backgroundColor || event.extendedProps?.color || ''
        }));

        // 現在の日付を取得
        const now = new Date();
        now.setHours(0, 0, 0, 0); // 時刻を00:00:00に設定

        // 過去のイベントと未来のイベントを分離
        const pastEvents = eventsArray.filter(event => {
            const eventDate = new Date(event.start);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate < now;
        });

        const futureEvents = eventsArray.filter(event => {
            const eventDate = new Date(event.start);
            eventDate.setHours(0, 0, 0, 0);
            return eventDate >= now;
        });

        // 未来のイベントを+2個までに制限
        const limitedFutureEvents = futureEvents.slice(0, 2);

        // イベント種類フィルターを取得
        const eventTypeFilter = document.querySelector('input[name="eventTypeFilter"]:checked').value;
        
        // イベント種類でフィルタリング
        const filterEventsByType = (events) => {
            return events.filter(event => {
                if (eventTypeFilter === 'all') return true;
                
                const tags = event.tags || [];
                if (eventTypeFilter === 'pokemon') {
                    return tags.includes('新ポケモン') && !tags.includes('新フィールド');
                } else if (eventTypeFilter === 'field') {
                    return tags.includes('新フィールド');
                } else if (eventTypeFilter === 'events') {
                    return (tags.includes('イベント') || tags.includes('キャンペーン')) && 
                           !tags.includes('満月') && !tags.includes('新月');
                } else if (eventTypeFilter === 'regular') {
                    return tags.includes('NMD') || tags.includes('GSD');
                }
                return true;
            });
        };
        
        // フィルタリングを適用
        const filteredPastEvents = filterEventsByType(pastEvents);
        const filteredFutureEvents = filterEventsByType(limitedFutureEvents);
        
        // 定常イベントの場合は、過去のイベントもすべて表示
        let finalPastEvents = filteredPastEvents;
        if (eventTypeFilter === 'regular') {
            // 定常イベントの場合は、過去のイベントもすべて含める
            const allRegularEvents = filterEventsByType(eventsArray);
            finalPastEvents = allRegularEvents.filter(event => {
                const eventDate = new Date(event.start);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate < now;
            });
        }
        
        // 過去のイベントと未来のイベントをそれぞれソート（新しい順）
        finalPastEvents.sort((a, b) => {
            const dateA = new Date(a.start);
            const dateB = new Date(b.start);
            return dateB - dateA; // 新しい順
        });

        filteredFutureEvents.sort((a, b) => {
            const dateA = new Date(a.start);
            const dateB = new Date(b.start);
            return dateA - dateB; // 未来のイベントは日付順
        });

        // 配列を結合（新しい順：未来のイベント → 過去のイベント）
        const finalEventsArray = [...filteredFutureEvents, ...finalPastEvents];

        // HTMLを生成
        eventListContent.innerHTML = finalEventsArray.map(event => {
            const startDate = new Date(event.start);
            const endDate = event.end ? new Date(event.end) : null;
            
            const startDateStr = startDate.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            let periodStr = startDateStr;
            if (endDate && !event.allDay) {
                const endDateStr = endDate.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                if (startDateStr !== endDateStr) {
                    periodStr = `${startDateStr} - ${endDateStr}`;
                }
            } else if (endDate && event.allDay) {
                const endDateStr = endDate.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
                if (startDateStr !== endDateStr) {
                    periodStr = `${startDateStr} - ${endDateStr}`;
                }
            }

            const tagsHtml = event.tags.map(tag => 
                `<span class="event-list-item-tag">${tag}</span>`
            ).join('');

            return `
                <div class="event-list-item" data-event-id="${event.id}">
                    <div class="event-list-item-info">
                        <div class="event-list-item-title">${event.title}</div>
                        <div class="event-list-item-period">${periodStr}</div>
                        <div class="event-list-item-tags">${tagsHtml}</div>
                    </div>
                </div>
            `;
        }).join('');

        // イベントアイテムのクリックイベント
        eventListContent.querySelectorAll('.event-list-item').forEach(item => {
            item.addEventListener('click', function() {
                const eventId = this.getAttribute('data-event-id');
                const event = allEvents.find(e => e.id === eventId);
                if (event) {
                    // 現在のスクロール位置を保存
                    const eventListContainer = document.querySelector('.event-list-container');
                    eventListScrollPosition = eventListContainer.scrollTop;
                    
                    // イベント詳細モーダルを表示
                    const eventListModal = document.getElementById('eventListModal');
                    eventListModal.style.display = 'none';
                    showEventModal(event);
                }
            });
        });
    }

    // イベント一覧のスクロール位置を保存する変数
    let eventListScrollPosition = 0;

    // イベント一覧のフィルタリング
    function filterEventList() {
        const searchInput = document.getElementById('eventSearchInput');
        const searchTerm = searchInput.value.toLowerCase();
        const eventItems = document.querySelectorAll('.event-list-item');
        
        eventItems.forEach(item => {
            const title = item.querySelector('.event-list-item-title').textContent.toLowerCase();
            const tags = Array.from(item.querySelectorAll('.event-list-item-tag')).map(tag => tag.textContent.toLowerCase());
            
            const matchesSearch = title.includes(searchTerm) || tags.some(tag => tag.includes(searchTerm));
            
            if (matchesSearch) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    // アプリケーションの初期化
    async function initApp() {
        const events = await loadEvents();
        initializeCalendar(events);
        setupNavigation();
        setupModal();
        setupFilters();
        setupEventList();
    }

    // アプリケーション開始
    await initApp();
});

