// カレンダーアプリケーションのメインJavaScript

document.addEventListener('DOMContentLoaded', async function() {
    let calendar;
    let eventsData = [];

    // 非公式リンクデータを読み込む
    async function loadUnofficialLinks() {
        try {
            const res = await fetch('data/events_unofficial.json');
            if (!res.ok) {
                // ファイルが存在しない場合は空のオブジェクトを返す
                console.warn('非公式リンクファイルが見つかりません');
                return {};
            }
            return await res.json();
        } catch (error) {
            console.error('非公式リンクデータの読み込みエラー:', error);
            return {};
        }
    }

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
            
            // 非公式リンクデータを読み込む
            const unofficialLinksData = await loadUnofficialLinks();
            
            // FullCalendar用にイベントデータを変換
            const formattedEvents = events.map(event => {
                // 既にFullCalendar形式の場合はそのまま返す
                if (event.id && event.title && event.start) {
                    let displayEnd = event.end || null;
                    
                    // 週イベントの表示調整：endが開始日の1日以上後の場合、表示上は前日までとする
                    if (displayEnd && event.allDay !== false) {
                        // 日付文字列（YYYY-MM-DD）を直接パースして計算（タイムゾーン問題を回避）
                        const startParts = event.start.split('-').map(Number);
                        const endParts = displayEnd.split('-').map(Number);
                        
                        // 日付オブジェクトを作成（UTCで作成してタイムゾーン問題を回避）
                        const startDateOnly = new Date(Date.UTC(startParts[0], startParts[1] - 1, startParts[2]));
                        const endDateOnly = new Date(Date.UTC(endParts[0], endParts[1] - 1, endParts[2]));
                        
                        // 終了日が開始日の1日以上後の場合
                        const daysDiff = Math.floor((endDateOnly - startDateOnly) / (1000 * 60 * 60 * 24));
                        
                        if (daysDiff >= 1) {
                            // FullCalendarのendは排他的（その日を含まない）ため、
                            // 28日まで表示するにはend: "2025-12-29"が必要
                            // つまり、元のendをそのまま使用する（1日引かない）
                            // displayEndは既に元のendと同じ値なので、そのまま使用
                        }
                    }
                    
                    // イベントIDで非公式リンクを取得
                    const unofficialLinks = unofficialLinksData[event.id] || [];
                    
                    return {
                        id: event.id,
                        title: event.title,
                        start: event.start,
                        end: displayEnd,
                        allDay: event.allDay !== false, // デフォルトは終日
                        backgroundColor: event.color || '#5a9b8e',
                        borderColor: event.color || '#5a9b8e',
                        textColor: '#ffffff',
                        extendedProps: {
                            description: event.description || '',
                            tags: event.tags || [],
                            link: event.link || '',
                            color: event.color || '#5a9b8e',
                            color2: event.color2 || null,
                            unofficialLinks: unofficialLinks
                        }
                    };
                }
                return event;
            });
            
            return formattedEvents;
        } catch (error) {
            console.error('イベントデータの読み込みエラー:', error);
            return [];
        }
    }


    // 曜日を取得する関数
    function getWeekday(dateStr) {
        const date = new Date(dateStr);
        const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
        return weekdays[date.getDay()];
    }

    // 日付をフォーマットする関数（イベント一覧用）
    function formatDateForList(dateStr) {
        const date = new Date(dateStr);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const weekday = getWeekday(dateStr);
        return `${year}年${month}月${day}日（${weekday}）`;
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
            // 過去のイベントも表示するための設定
            showNonCurrentDates: true,
            fixedWeekCount: false,
            // 表示可能な日付範囲を制限（2023年7月以降）
            validRange: {
                start: '2023-07-01'
            },
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

    // 指定されたイベントの月にカレンダーを移動
    function goToEventMonth(eventDateStr) {
        if (!calendar) return;
        
        const eventDate = new Date(eventDateStr);
        
        // カレンダーを指定された月に移動
        calendar.gotoDate(eventDate);
        
        // 月表示を更新
        updateCurrentMonthDisplay(eventDate);
        
        // スムーズスクロールでカレンダーを表示
        const calendarElement = document.getElementById('calendar');
        if (calendarElement) {
            calendarElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }

    // カスタムナビゲーションボタンの設定
    function setupNavigation() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const todayBtn = document.getElementById('todayBtn');

        prevBtn.addEventListener('click', function() {
            const currentDate = calendar.getDate();
            const minDate = new Date('2023-07-01');
            
            // 2023年7月以前に移動しようとした場合は制限
            if (currentDate.getFullYear() === 2023 && currentDate.getMonth() === 6) {
                return; // 2023年7月の場合は前月に移動しない
            }
            
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
        const modalGoToMonthBtn = document.getElementById('modalGoToMonthBtn');

        // 背景スクロールを無効化
        document.body.classList.add('modal-open');

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

        // 非公式リンクの表示（常に表示、リンクがない場合でも追加ボタンは表示）
        const modalUnofficialLinks = document.getElementById('modalUnofficialLinks');
        const modalUnofficialLinksList = document.getElementById('modalUnofficialLinksList');
        const unofficialLinks = extendedProps.unofficialLinks || [];
        
        // 非公式リンクセクションを常に表示
        modalUnofficialLinks.style.display = 'block';
        modalUnofficialLinksList.innerHTML = '';
        
        // 非公式リンクがある場合は表示
        if (unofficialLinks.length > 0) {
            unofficialLinks.forEach((unofficialLink, index) => {
                const tweetId = extractTweetId(unofficialLink.url || '');
                
                if (tweetId) {
                    // Xのツイートを埋め込む（投稿者名は表示しない）
                    const tweetWrapper = document.createElement('div');
                    tweetWrapper.className = 'unofficial-tweet-wrapper';
                    tweetWrapper.id = `tweet-wrapper-${event.id}-${index}`;
                    
                    modalUnofficialLinksList.appendChild(tweetWrapper);
                    
                    // Twitterウィジェットでツイートを埋め込む
                    const loadTweet = () => {
                        if (window.twttr && window.twttr.widgets) {
                            window.twttr.widgets.createTweet(tweetId, tweetWrapper, {
                                theme: 'light',
                                align: 'center'
                            }).catch(err => {
                                console.error('ツイートの読み込みエラー:', err);
                            });
                        } else {
                            setTimeout(() => {
                                if (window.twttr && window.twttr.widgets) {
                                    loadTweet();
                                }
                            }, 500);
                        }
                    };
                    
                    if (window.twttr) {
                        window.twttr.ready(loadTweet);
                    } else {
                        const checkTwttr = setInterval(() => {
                            if (window.twttr) {
                                clearInterval(checkTwttr);
                                window.twttr.ready(loadTweet);
                            }
                        }, 100);
                        
                        setTimeout(() => {
                            clearInterval(checkTwttr);
                        }, 5000);
                    }
                } else {
                    // X以外のURLの場合はOGPサムネイル付きリンクカードとして表示
                    const linkCard = document.createElement('a');
                    linkCard.className = 'unofficial-link-card';
                    linkCard.href = unofficialLink.url || '#';
                    linkCard.target = '_blank';
                    linkCard.rel = 'noopener noreferrer';
                    
                    // リンクカードのコンテンツ
                    const cardContent = document.createElement('div');
                    cardContent.className = 'unofficial-link-card-content';
                    
                    // サムネイルエリア（OGP画像を後で設定）
                    const thumbnail = document.createElement('div');
                    thumbnail.className = 'unofficial-link-card-thumbnail';
                    thumbnail.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 13V19A2 2 0 0 1 16 21H5A2 2 0 0 1 3 19V8A2 2 0 0 1 5 6H11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    `;
                    
                    // テキストエリア
                    const textArea = document.createElement('div');
                    textArea.className = 'unofficial-link-card-text';
                    const nameDiv = document.createElement('div');
                    nameDiv.className = 'unofficial-link-card-name';
                    nameDiv.textContent = unofficialLink.name || 'リンク';
                    const urlDiv = document.createElement('div');
                    urlDiv.className = 'unofficial-link-card-url';
                    urlDiv.textContent = unofficialLink.url || '';
                    
                    textArea.appendChild(nameDiv);
                    textArea.appendChild(urlDiv);
                    
                    cardContent.appendChild(thumbnail);
                    cardContent.appendChild(textArea);
                    linkCard.appendChild(cardContent);
                    
                    modalUnofficialLinksList.appendChild(linkCard);
                    
                    // OGP画像を取得してサムネイルに設定
                    fetchOGPImage(unofficialLink.url).then(imageUrl => {
                        if (imageUrl) {
                            const img = document.createElement('img');
                            img.src = imageUrl;
                            img.alt = '';
                            img.onerror = function() {
                                // 画像読み込みエラー時はデフォルトアイコンを表示
                                thumbnail.innerHTML = `
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18 13V19A2 2 0 0 1 16 21H5A2 2 0 0 1 3 19V8A2 2 0 0 1 5 6H11" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                        <path d="M10 14L21 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                `;
                            };
                            thumbnail.innerHTML = '';
                            thumbnail.appendChild(img);
                        }
                    }).catch(err => {
                        console.error('OGP画像の取得エラー:', err);
                    });
                }
            });
        }

        // GoogleFormsリンクの設定
        const modalUnofficialAddLink = document.getElementById('modalUnofficialAddLink');
        modalUnofficialAddLink.href = 'https://forms.gle/NVjAqkkyqn9NcMCw7';

        // 「対象月に移動」ボタンの設定
        modalGoToMonthBtn.setAttribute('data-event-date', event.start);
        modalGoToMonthBtn.addEventListener('click', function() {
            const eventDate = this.getAttribute('data-event-date');
            goToEventMonth(eventDate);
            
            // モーダルを閉じる
            modal.style.display = 'none';
            
            // イベント一覧モーダルが開いていた場合は閉じる（「対象月へ移動」の場合は再表示しない）
            if (isEventListModalOpen) {
                const eventListModal = document.getElementById('eventListModal');
                eventListModal.style.display = 'none';
                isEventListModalOpen = false; // フラグをリセット
            }
            
            document.body.classList.remove('modal-open');
        });

        // （任意）モーダルのアクセントにイベント色を反映
        const color = event.backgroundColor || extendedProps.color || '';
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent && color) {
            modalContent.style.borderTop = `4px solid ${color}`;
        }

        // モーダルを表示
        modal.style.display = 'block';
    }

    // X（Twitter）のURLからツイートIDを抽出
    function extractTweetId(url) {
        if (!url) return null;
        
        // x.com または twitter.com のURLからツイートIDを抽出
        const match = url.match(/(?:x\.com|twitter\.com)\/\w+\/status\/(\d+)/);
        return match ? match[1] : null;
    }

    // OGP画像を取得（高速化：並列で試行し、タイムアウトを設定）
    async function fetchOGPImage(url) {
        if (!url) return null;
        
        try {
            // タイムアウトを3秒に設定
            const timeout = 3000;
            
            // 複数のプロキシを並列で試行（最初に成功したものを返す）
            const proxies = [
                'https://api.allorigins.win/raw?url=',
                'https://corsproxy.io/?'
            ];
            
            const promises = proxies.map(proxyBase => 
                Promise.race([
                    fetchOGPImageWithProxy(url, proxyBase),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Timeout')), timeout)
                    )
                ]).catch(() => null)
            );
            
            // 最初に成功した結果を返す
            const results = await Promise.allSettled(promises);
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value) {
                    return result.value;
                }
            }
            
            return null;
        } catch (error) {
            console.error('OGP画像の取得エラー:', error);
            return null;
        }
    }

    // CORSプロキシ経由でOGP画像を取得（高速化：AbortControllerでタイムアウト）
    async function fetchOGPImageWithProxy(url, proxyBase) {
        try {
            const proxyUrl = `${proxyBase}${encodeURIComponent(url)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒でタイムアウト
            
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html'
                },
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) return null;
            
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // og:image メタタグを取得
            const ogImage = doc.querySelector('meta[property="og:image"]');
            if (ogImage) {
                let imageUrl = ogImage.getAttribute('content');
                if (imageUrl) {
                    // 相対パスの場合は絶対パスに変換
                    if (imageUrl.startsWith('//')) {
                        imageUrl = 'https:' + imageUrl;
                    } else if (imageUrl.startsWith('/')) {
                        const urlObj = new URL(url);
                        imageUrl = urlObj.origin + imageUrl;
                    } else if (!imageUrl.startsWith('http')) {
                        const urlObj = new URL(url);
                        imageUrl = urlObj.origin + '/' + imageUrl;
                    }
                    return imageUrl;
                }
            }
            
            // og:image がない場合は twitter:image を試す
            const twitterImage = doc.querySelector('meta[name="twitter:image"]');
            if (twitterImage) {
                let imageUrl = twitterImage.getAttribute('content');
                if (imageUrl) {
                    // 相対パスの場合は絶対パスに変換
                    if (imageUrl.startsWith('//')) {
                        imageUrl = 'https:' + imageUrl;
                    } else if (imageUrl.startsWith('/')) {
                        const urlObj = new URL(url);
                        imageUrl = urlObj.origin + imageUrl;
                    } else if (!imageUrl.startsWith('http')) {
                        const urlObj = new URL(url);
                        imageUrl = urlObj.origin + '/' + imageUrl;
                    }
                    return imageUrl;
                }
            }
            
            return null;
        } catch (error) {
            if (error.name === 'AbortError') {
                // タイムアウトエラーは無視
                return null;
            }
            console.error('OGP画像の取得エラー（プロキシ）:', error);
            return null;
        }
    }

    // 非公式リンクモーダルを表示
    function showUnofficialLinkModal(unofficialLink) {
        const modal = document.getElementById('unofficialLinkModal');
        const modalTitle = document.getElementById('unofficialLinkModalTitle');
        const linkName = document.getElementById('unofficialLinkName');
        const linkContent = document.getElementById('unofficialLinkContent');
        const linkOpenBtn = document.getElementById('unofficialLinkOpenBtn');

        // 背景スクロールを無効化
        document.body.classList.add('modal-open');

        // リンク情報を設定
        linkName.textContent = unofficialLink.name || '@不明';
        
        const url = unofficialLink.url || '';
        linkOpenBtn.href = url;
        
        // X（Twitter）のURLかどうかを判定
        const tweetId = extractTweetId(url);
        
        // コンテンツエリアをクリア
        linkContent.innerHTML = '';
        
        if (tweetId) {
            // Xのツイートを埋め込む
            const tweetContainer = document.createElement('div');
            tweetContainer.id = `tweet-${tweetId}`;
            linkContent.appendChild(tweetContainer);
            
            // ローディング表示
            const loadingDisplay = document.createElement('div');
            loadingDisplay.className = 'unofficial-link-url-display';
            loadingDisplay.textContent = 'ツイートを読み込み中...';
            linkContent.appendChild(loadingDisplay);
            
            // Twitterウィジェットを読み込む
            const loadTweet = () => {
                if (window.twttr && window.twttr.widgets) {
                    // ローディング表示を削除
                    loadingDisplay.remove();
                    
                    window.twttr.widgets.createTweet(tweetId, tweetContainer, {
                        theme: 'light',
                        align: 'center'
                    }).catch(err => {
                        console.error('ツイートの読み込みエラー:', err);
                        // エラー時はURLを表示
                        tweetContainer.remove();
                        const urlDisplay = document.createElement('div');
                        urlDisplay.className = 'unofficial-link-url-display';
                        urlDisplay.textContent = url;
                        linkContent.appendChild(urlDisplay);
                    });
                } else {
                    // Twitterウィジェットがまだ読み込まれていない場合、少し待ってから再試行
                    setTimeout(() => {
                        if (window.twttr && window.twttr.widgets) {
                            loadTweet();
                        } else {
                            // タイムアウト時はURLを表示
                            loadingDisplay.textContent = url;
                            loadingDisplay.className = 'unofficial-link-url-display';
                            tweetContainer.remove();
                        }
                    }, 500);
                }
            };
            
            // ウィジェットが既に読み込まれている場合
            if (window.twttr) {
                window.twttr.ready(loadTweet);
            } else {
                // ウィジェットの読み込みを待つ
                const checkTwttr = setInterval(() => {
                    if (window.twttr) {
                        clearInterval(checkTwttr);
                        window.twttr.ready(loadTweet);
                    }
                }, 100);
                
                // タイムアウト（5秒）
                setTimeout(() => {
                    clearInterval(checkTwttr);
                    if (!window.twttr || !window.twttr.widgets) {
                        loadingDisplay.textContent = url;
                        loadingDisplay.className = 'unofficial-link-url-display';
                        tweetContainer.remove();
                    }
                }, 5000);
            }
        } else {
            // X以外のURLの場合はURLを表示
            const urlDisplay = document.createElement('div');
            urlDisplay.className = 'unofficial-link-url-display';
            urlDisplay.textContent = url || 'URLがありません';
            linkContent.appendChild(urlDisplay);
        }
        
        // モーダルを表示
        modal.style.display = 'block';
    }

    // 非公式リンクモーダルを閉じる
    function setupUnofficialLinkModal() {
        const modal = document.getElementById('unofficialLinkModal');
        const closeBtn = document.querySelector('.unofficial-link-close');
        const linkContent = document.getElementById('unofficialLinkContent');

        const closeModal = function() {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
            // ツイート埋め込みをクリア
            if (linkContent) {
                linkContent.innerHTML = '';
            }
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeModal();
            }
        });
    }

    // モーダルを閉じる
    function setupModal() {
        const modal = document.getElementById('eventModal');
        const closeBtn = document.querySelector('.close');

        closeBtn.addEventListener('click', function() {
            modal.style.display = 'none';
            
            // イベント一覧モーダルが開いていた場合は再表示
            if (isEventListModalOpen) {
                const eventListModal = document.getElementById('eventListModal');
                eventListModal.style.display = 'block';
                
                // スクロール位置を復元
                const eventListContainer = document.querySelector('.event-list-container');
                if (eventListContainer) {
                    eventListContainer.scrollTop = eventListScrollPosition;
                }
            } else {
                document.body.classList.remove('modal-open');
            }
        });

        window.addEventListener('click', function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
                
                // イベント一覧モーダルが開いていた場合は再表示
                if (isEventListModalOpen) {
                    const eventListModal = document.getElementById('eventListModal');
                    eventListModal.style.display = 'block';
                    
                    // スクロール位置を復元
                    const eventListContainer = document.querySelector('.event-list-container');
                    if (eventListContainer) {
                        eventListContainer.scrollTop = eventListScrollPosition;
                    }
                } else {
                    document.body.classList.remove('modal-open');
                }
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
            document.body.classList.remove('modal-open');
            isEventListModalOpen = false; // フラグをリセット
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
                document.body.classList.remove('modal-open');
                isEventListModalOpen = false; // フラグをリセット
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
        
        // 背景スクロールを無効化
        document.body.classList.add('modal-open');
        
        // イベント一覧モーダルが開いていることを記録
        isEventListModalOpen = true;
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
            
            const startDateStr = formatDateForList(event.start);
            
            let periodStr = startDateStr;
            if (endDate && event.allDay) {
                const endDateStr = formatDateForList(event.end);
                if (startDateStr !== endDateStr) {
                    periodStr = `${startDateStr}〜${endDateStr}`;
                }
            } else if (endDate && !event.allDay) {
                const endDateStr = formatDateForList(event.end);
                if (startDateStr !== endDateStr) {
                    periodStr = `${startDateStr}〜${endDateStr}`;
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
                    <div class="event-list-item-actions">
                        <button class="go-to-month-btn" data-event-date="${event.start}" title="対象月に移動">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 2V5M16 2V5M3.5 9.09H20.5M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M15.6947 13.7H15.7037M15.6947 16.7H15.7037M11.9955 13.7H12.0045M11.9955 16.7H12.0045M8.29431 13.7H8.30329M8.29431 16.7H8.30329" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // イベントアイテムのクリックイベント
        eventListContent.querySelectorAll('.event-list-item').forEach(item => {
            item.addEventListener('click', function(e) {
                // ボタンクリックの場合は詳細表示をスキップ
                if (e.target.closest('.go-to-month-btn')) {
                    return;
                }
                
                const eventId = this.getAttribute('data-event-id');
                const event = allEvents.find(e => e.id === eventId);
                if (event) {
                    // 現在のスクロール位置を保存
                    const eventListContainer = document.querySelector('.event-list-container');
                    eventListScrollPosition = eventListContainer.scrollTop;
                    
                    // イベント詳細モーダルを表示（イベント一覧モーダルは非表示にするが、フラグは維持）
                    const eventListModal = document.getElementById('eventListModal');
                    eventListModal.style.display = 'none';
                    showEventModal(event);
                }
            });
        });

        // 「対象月に移動」ボタンのクリックイベント
        eventListContent.querySelectorAll('.go-to-month-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation(); // 親要素のクリックイベントを防ぐ
                const eventDate = this.getAttribute('data-event-date');
                goToEventMonth(eventDate);
                
                // イベント一覧モーダルを閉じる
                const eventListModal = document.getElementById('eventListModal');
                eventListModal.style.display = 'none';
                document.body.classList.remove('modal-open');
                isEventListModalOpen = false; // フラグをリセット
            });
        });
    }

    // イベント一覧のスクロール位置を保存する変数
    let eventListScrollPosition = 0;
    
    // イベント一覧から詳細モーダルを開いたかどうかを管理する変数
    let isEventListModalOpen = false;

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
        setupUnofficialLinkModal();
        setupFilters();
        setupEventList();
    }

    // アプリケーション開始
    await initApp();
});

