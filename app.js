const GOOGLE_LOGIN_STORAGE_KEY = 'googleUserCredential';

function persistGoogleCredential(credential, userObj) {
    try {
        localStorage.setItem(GOOGLE_LOGIN_STORAGE_KEY, JSON.stringify({
            credential,
            user: userObj,
            ts: Date.now()
        }));
    } catch (e) {}
}

function clearPersistedGoogleCredential() {
    try { localStorage.removeItem(GOOGLE_LOGIN_STORAGE_KEY); } catch (e) {}
}

function getPersistedGoogleCredential() {
    try {
        const raw = localStorage.getItem(GOOGLE_LOGIN_STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        // Check JWT token expiry (1 hour)
        if (data && data.credential && data.user) {
            const parts = data.credential.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                if (payload.exp && Date.now() / 1000 < payload.exp) {
                    return data;
                }
            }
        }
        return null;
    } catch (e) { return null; }
}

// Enhanced Game State Management with Mobile-Optimized Google Identity Services

// Google Drive API Configuration - Updated with fixed credentials
const GOOGLE_CONFIG = {
    apiKey: 'AIzaSyAc6cpX92QtlxoBz5uDJVaLGW18oD0R0Hs',
    clientId: '969122977239-1n1vhboklrshhlfv70ak1jhtd47hb0ef.apps.googleusercontent.com',
    discoveryDoc: 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
    scopes: 'https://www.googleapis.com/auth/drive.file',
    appName: 'Gambling Scorekeeper'
};

// Device Detection Functions
function isMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const mobileRegex = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
    const isMobileUA = mobileRegex.test(userAgent);
    const isMobileScreen = window.innerWidth <= 768;
    const result = isMobileUA || isMobileScreen;
    console.log('🔍 Device detection:', {
        userAgent: userAgent.substring(0, 50) + '...',
        isMobileUA,
        isMobileScreen,
        screenWidth: window.innerWidth,
        result: result ? 'Mobile' : 'Desktop'
    });
    return result;
}

function isIOSSafari() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    return /iPad|iPhone|iPod/.test(userAgent) && /Safari/.test(userAgent) && !/CriOS|FxiOS|OPiOS|mercury/.test(userAgent);
}

// --- Google Login Persistence Patch ---
// The following logic will persist the user's Google login status across page refreshes
// by storing the most recent credential (ID token) and user info in localStorage.
// On next page load, if a valid credential is found, the app will restore sign-in state automatically.
// For security, the access token is NOT persisted; only the ID token and user info are cached for silent restoration.

// Google Drive Manager Class with Mobile-Optimized Google Identity Services
class GoogleDriveManager {
    constructor() {
        this.isSignedIn = false;
        this.currentUser = null;
        this.appFolderId = null;
        this.isInitialized = false;
        this.accessToken = null;
        this.tokenClient = null;
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.initRetryCount = 0;
        this.isInitializing = false;

        // --- Google Login Persistence Patch: Preload user state if possible ---
        // This enables much better UX: user stays logged in after refresh.
        const persisted = getPersistedGoogleCredential();
        if (persisted) {
            this.isSignedIn = true;
            this.currentUser = persisted.user;
            this.idToken = persisted.credential; // Store original credential (id_token)
        }
    }

    async initialize() {
        if (this.isInitializing) {
            console.log('⏳ Initialization already in progress...');
            return false;
        }

        this.isInitializing = true;

        try {
            console.log('🔍 Starting Google Drive API initialization...');
            console.log('📱 Device type:', isMobileDevice() ? 'Mobile' : 'Desktop');
            console.log('🍎 iOS Safari:', isIOSSafari());
            
            // 檢查配置
            if (!GOOGLE_CONFIG.apiKey || !GOOGLE_CONFIG.clientId) {
                console.log('❌ Google Drive API credentials not configured');
                this.updateAuthUI();
                this.isInitializing = false;
                return false;
            }

            // 等待 Google APIs 載入
            let attempts = 0;
            const maxAttempts = 10;
            
            while (attempts < maxAttempts) {
                if (typeof gapi !== 'undefined' && typeof google !== 'undefined') {
                    console.log('✅ Google APIs detected');
                    break;
                }
                console.log(`⏳ Waiting for Google APIs... (${attempts + 1}/${maxAttempts})`);
                await new Promise(resolve => setTimeout(resolve, 500));
                attempts++;
            }

            if (typeof gapi === 'undefined') {
                console.log('❌ Google API client not loaded after waiting');
                showNotification('Google API 載入失敗，請重新整理頁面', 'error');
                this.isInitializing = false;
                return false;
            }

            if (typeof google === 'undefined') {
                console.log('❌ Google Identity Services not loaded after waiting');
                showNotification('Google 身份服務載入失敗，請重新整理頁面', 'error');
                this.isInitializing = false;
                return false;
            }

            console.log('📚 Loading Google API client...');
            
            // 加載gapi client
            await new Promise((resolve, reject) => {
                gapi.load('client', {
                    callback: () => {
                        console.log('✅ gapi.client loaded');
                        resolve();
                    },
                    onerror: () => {
                        console.log('❌ Failed to load gapi.client');
                        reject(new Error('Failed to load gapi.client'));
                    }
                });
            });

            console.log('🔑 Initializing Google API client...');
            
            // 初始化gapi client
            await gapi.client.init({
                apiKey: GOOGLE_CONFIG.apiKey,
                discoveryDocs: [GOOGLE_CONFIG.discoveryDoc]
            });

            console.log('🆔 Initializing Google Identity Services...');
            
            // 根據裝置類型選擇不同的初始化方式
            const initConfig = {
                client_id: GOOGLE_CONFIG.clientId,
                callback: this.handleCredentialResponse.bind(this),
                auto_select: false,
                cancel_on_tap_outside: false
            };
            
            // 手機版使用redirect模式，桌面版使用popup模式
            if (isMobileDevice()) {
                console.log('📱 Using mobile-optimized settings...');
                initConfig.ux_mode = 'redirect';  // 手機版使用redirect
                initConfig.context = 'signin';
                initConfig.use_fedcm_for_prompt = false;
            } else {
                console.log('🖥️ Using desktop-optimized settings...');
                initConfig.ux_mode = 'popup';     // 桌面版使用popup
                initConfig.context = 'signin';
            }
            
            google.accounts.id.initialize(initConfig);

            // OAuth2 token client配置
            const tokenConfig = {
                client_id: GOOGLE_CONFIG.clientId,
                scope: GOOGLE_CONFIG.scopes,
                callback: this.handleTokenResponse.bind(this),
                error_callback: this.handleTokenError.bind(this)
            };
            
            // 手機版和桌面版使用不同的UX模式
            if (isMobileDevice()) {
                tokenConfig.ux_mode = 'redirect';
            } else {
                tokenConfig.ux_mode = 'popup';
            }
            
            this.tokenClient = google.accounts.oauth2.initTokenClient(tokenConfig);

            this.isInitialized = true;
            this.initRetryCount = 0;
            this.isInitializing = false;

            // --- Google Login Persistence Patch: Try restoring sign-in state ---
            // If a previous Google sign-in exists and token is still valid, restore session without requiring user prompt.
            const persisted = getPersistedGoogleCredential();
            if (persisted && !this.accessToken) {
                // Try to restore user session
                this.isSignedIn = true;
                this.currentUser = persisted.user;
                // Set ID token for reference
                this.idToken = persisted.credential;
                this.updateAuthUI();
                // Optionally, re-request an access token silently
                if (this.tokenClient) {
                    // Use prompt: '' for silent to avoid user consent dialog if possible
                    this.tokenClient.requestAccessToken({prompt: ''});
                }
                showNotification('Google Drive 已自動登入', 'success');
                return true;
            }

            this.updateAuthUI();
            console.log('✅ Google Identity Services initialized successfully');
            showNotification('Google Drive 服務已就緒', 'success');
            return true;
            
        } catch (error) {
            console.error('❌ Google Drive initialization failed:', error);
            this.isInitializing = false;
            this.updateAuthUI();
            showNotification('Google Drive 初始化失敗，部分功能可能受限', 'warning');
            return false;
        }
    }

    // 處理ID token（用於身份驗證）
    handleCredentialResponse(response) {
        console.log('🔐 Received credential response');
        updateSyncStatus('connecting');
        
        try {
            // 解析JWT token獲取用戶信息
            const payload = this.parseJwt(response.credential);
            
            this.currentUser = {
                id: payload.sub,
                name: payload.name,
                email: payload.email,
                picture: payload.picture
            };

            this.idToken = response.credential; // Save ID token for silent restoration

            // --- Google Login Persistence Patch: Save user info and credential ---
            persistGoogleCredential(response.credential, this.currentUser);

            console.log('👤 User signed in:', this.currentUser.name);
            
            // 現在請求訪問令牌
            this.requestAccessToken();
            
        } catch (error) {
            console.error('❌ Error handling credential:', error);
            updateSyncStatus('error');
            showNotification('登入失敗，請重試', 'error');
        }
    }

    // 請求訪問令牌（用於API調用）
    requestAccessToken() {
        console.log('🔑 Requesting access token...');
        
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken({prompt: ''});
        } else {
            console.error('❌ Token client not initialized');
            updateSyncStatus('error');
        }
    }

    // 處理訪問令牌響應
    async handleTokenResponse(response) {
        console.log('🎫 Received token response');
        
        if (response.error) {
            console.error('❌ Token request failed:', response.error);
            this.handleTokenError(response);
            return;
        }

        this.accessToken = response.access_token;
        this.isSignedIn = true;
        
        // 設置gapi client的訪問令牌
        if (typeof gapi !== 'undefined' && gapi.client) {
            gapi.client.setToken({
                access_token: this.accessToken
            });
        }

        // --- Google Login Persistence Patch: Mark as signed in ---
        if (this.currentUser && this.idToken) {
            persistGoogleCredential(this.idToken, this.currentUser);
        }

        console.log('✅ Successfully authenticated');
        
        try {
            if (typeof gapi !== 'undefined' && gapi.client) {
                await this.ensureAppFolder();
                await this.performInitialSync();
            }
            
            this.updateAuthUI();
            updateSyncStatus('synced');
            showNotification('Google Drive 連接成功！', 'success');
            
            // Start auto sync
            if (autoSync && !autoSync.isRunning) {
                autoSync.start();
            }
            
        } catch (error) {
            console.error('❌ Post-auth setup failed:', error);
            updateSyncStatus('error');
            showNotification('Google Drive 已登入，但雲端功能可能受限', 'warning');
        }
    }

    // 處理令牌錯誤 - 手機版專用
    handleTokenError(error) {
        console.error('❌ Token request failed:', error);
        updateSyncStatus('error');
        
        let message = '';
        let duration = 4000;
        
        if (isMobileDevice()) {
            if (error.type === 'popup_blocked') {
                message = '📱 請在瀏覽器設定中允許彈出視窗，然後重試';
                duration = 6000;
            } else if (error.type === 'access_denied' || error.error === 'access_denied') {
                message = '登入被取消，請重新嘗試';
            } else if (error.error === 'invalid_request') {
                message = '📱 建議切換到桌面版瀏覽器以獲得更好體驗';
                duration = 5000;
            } else {
                message = '手機登入失敗，請重試或使用桌面版';
            }
        } else {
            if (error.type === 'popup_blocked') {
                message = '請允許彈出視窗以完成登入';
            } else if (error.type === 'access_denied' || error.error === 'access_denied') {
                message = '登入被拒絕，請重試';
            } else {
                message = '授權失敗: ' + (error.message || error.error || error.type);
            }
        }
        
        showNotification(message, 'error', duration);
    }

    async signIn() {
        if (!this.isInitialized) {
            if (this.isInitializing) {
                showNotification('Google Drive 正在初始化中，請稍等...', 'warning');
                return false;
            }
            
            showNotification('正在初始化 Google Drive 服務...', 'warning');
            const initialized = await this.initialize();
            if (!initialized) {
                showNotification('Google Drive 初始化失敗，請重試', 'error');
                return false;
            }
        }

        try {
            // --- Google Login Persistence Patch: Try silent sign-in if persisted credential exists ---
            const persisted = getPersistedGoogleCredential();
            if (persisted && !this.accessToken) {
                // Skip prompting if user is already signed in and valid credential exists
                this.isSignedIn = true;
                this.currentUser = persisted.user;
                this.idToken = persisted.credential;
                this.updateAuthUI();
                if (this.tokenClient) {
                    this.tokenClient.requestAccessToken({prompt: ''});
                }
                showNotification('已自動登入 Google 帳號', 'success');
                return true;
            }

            console.log('🚀 Starting sign-in process...');
            updateSyncStatus('connecting');
            
            if (isMobileDevice()) {
                console.log('📱 Mobile sign-in flow...');
                this.showMobileSignInButton();
            } else {
                console.log('🖥️ Desktop sign-in flow...');
                this.renderSignInButton();
                try {
                    google.accounts.id.prompt((notification) => {
                        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                            console.log('🔘 Prompt not displayed, showing button');
                            this.renderSignInButton();
                        }
                    });
                } catch (promptError) {
                    console.log('⚠️ Prompt failed, showing button:', promptError);
                    this.renderSignInButton();
                }
            }
            return true;
        } catch (error) {
            console.error('❌ Sign-in failed:', error);
            updateSyncStatus('error');
            showNotification('登入失敗: ' + error.message, 'error');
            return false;
        }
    }

    showMobileSignInButton() {
        const buttonContainer = document.getElementById('googleSignInButton');
        const manualBtn = document.getElementById('manualSignInBtn');
        
        if (!buttonContainer) return;
        
        console.log('📱 Showing mobile sign-in button');
        
        buttonContainer.innerHTML = '';
        
        const mobileButton = document.createElement('button');
        mobileButton.className = 'btn btn--primary btn--lg btn--full-width mobile-google-btn';
        mobileButton.innerHTML = `
            <span class="google-icon">G</span>
            使用Google帳號登入
            <span class="mobile-hint">（手機版）</span>
        `;
        
        mobileButton.onclick = () => {
            console.log('📱 Mobile Google sign-in triggered');
            try {
                google.accounts.id.prompt();
            } catch (error) {
                console.error('Mobile sign-in error:', error);
                if (this.tokenClient) {
                    this.tokenClient.requestAccessToken({prompt: 'consent'});
                }
            }
        };
        
        buttonContainer.appendChild(mobileButton);
        if (manualBtn) manualBtn.style.display = 'none';
        
        const helpText = document.createElement('div');
        helpText.className = 'mobile-help-text';
        helpText.innerHTML = `
            <p><small>📱 手機版登入提示：</small></p>
            <ul>
                <li><small>請允許瀏覽器的彈出視窗</small></li>
                <li><small>某些瀏覽器可能會轉向新頁面</small></li>
                <li><small>登入完成後會自動返回</small></li>
            </ul>
        `;
        buttonContainer.appendChild(helpText);
        
        buttonContainer.classList.remove('hidden');
    }

    async signOut() {
        try {
            if (this.isSignedIn) {
                if (this.accessToken && typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
                    google.accounts.oauth2.revoke(this.accessToken);
                }
                
                this.isSignedIn = false;
                this.currentUser = null;
                this.accessToken = null;
                this.appFolderId = null;
                this.idToken = null;

                // --- Google Login Persistence Patch: Remove cached credential on sign out ---
                clearPersistedGoogleCredential();
                
                if (typeof gapi !== 'undefined' && gapi.client) {
                    gapi.client.setToken(null);
                }
                
                this.updateAuthUI();
                updateSyncStatus('signed_out');
                showNotification('已登出 Google 帳號', 'success');
                
                if (autoSync && autoSync.isRunning) {
                    autoSync.stop();
                }
            }
        } catch (error) {
            console.error('❌ Sign-out failed:', error);
            showNotification('登出失敗: ' + error.message, 'error');
        }
    }

    renderSignInButton() {
        const buttonContainer = document.getElementById('googleSignInButton');
        if (!buttonContainer || typeof google === 'undefined' || !google.accounts) {
            console.log('Cannot render sign-in button: container or Google services not available');
            return;
        }

        try {
            buttonContainer.innerHTML = '';
            google.accounts.id.renderButton(buttonContainer, {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                width: 300
            });
            buttonContainer.classList.remove('hidden');
            console.log('✅ Google Sign-In button rendered successfully');
        } catch (error) {
            console.error('Failed to render Google Sign-In button:', error);
            buttonContainer.innerHTML = `
                <button class="btn btn--outline btn--full-width" onclick="signInGoogle()">
                    <span class="google-icon">G</span>
                    使用Google帳號登入
                </button>
            `;
            buttonContainer.classList.remove('hidden');
        }
    }

    updateAuthUI() {
        const signInButton = document.getElementById('googleSignInButton');
        const userInfo = document.getElementById('googleUserInfo');
        const userName = document.getElementById('googleUserName');
        const userEmail = document.getElementById('googleUserEmail');
        const userAvatar = document.getElementById('userAvatar');

        if (!signInButton || !userInfo) return;

        if (this.isSignedIn && this.currentUser) {
            signInButton.classList.add('hidden');
            userInfo.classList.remove('hidden');
            
            if (userName) userName.textContent = this.currentUser.name;
            if (userEmail) userEmail.textContent = this.currentUser.email;
            if (userAvatar) userAvatar.src = this.currentUser.picture || '';
        } else {
            signInButton.classList.remove('hidden');
            userInfo.classList.add('hidden');
            if (this.isInitialized && typeof google !== 'undefined' && google.accounts) {
                setTimeout(() => {
                    if (isMobileDevice()) {
                        this.showMobileSignInButton();
                    } else {
                        this.renderSignInButton();
                    }
                }, 100);
            } else {
                signInButton.innerHTML = `
                    <button class="btn btn--outline btn--full-width" onclick="signInGoogle()">
                        <span class="google-icon">G</span>
                        使用Google帳號登入${isMobileDevice() ? ' (手機版)' : ''}
                    </button>
                `;
                signInButton.classList.remove('hidden');
            }
        }
        
        updateSyncStatus();
    }

    parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                atob(base64)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('Failed to parse JWT token:', error);
            throw error;
        }
    }

    async ensureAppFolder() {
        if (typeof gapi === 'undefined' || !gapi.client || !gapi.client.drive) {
            console.log('Google Drive API not available');
            return;
        }
        
        try {
            const response = await gapi.client.drive.files.list({
                q: `name='${GOOGLE_CONFIG.appName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
                spaces: 'drive'
            });

            if (response.result.files.length > 0) {
                this.appFolderId = response.result.files[0].id;
                console.log('Found existing app folder:', this.appFolderId);
            } else {
                const folderResponse = await gapi.client.drive.files.create({
                    resource: {
                        name: GOOGLE_CONFIG.appName,
                        mimeType: 'application/vnd.google-apps.folder'
                    }
                });
                
                this.appFolderId = folderResponse.result.id;
                console.log('Created new app folder:', this.appFolderId);
            }
        } catch (error) {
            console.error('Failed to ensure app folder:', error);
            throw error;
        }
    }

    async performInitialSync() {
        try {
            showSyncProgress('正在檢查雲端數據...', 25);
            await this.downloadAndMergeGameData();
        } catch (error) {
            console.error('Initial sync failed:', error);
            showSyncProgress('', 0);
        }
    }

        async uploadGameData(gameData) {
        if (!this.isSignedIn || !this.appFolderId || typeof gapi === 'undefined' || !gapi.client) {
            throw new Error('Not authenticated or Google Drive API not available');
        }

        try {
            const fileName = 'games-data.json';
            const dataToUpload = {
                metadata: {
                    version: '2.0',
                    appName: GOOGLE_CONFIG.appName,
                    lastSync: new Date().toISOString(),
                    deviceId: this.getDeviceId(),
                    userId: this.currentUser.email
                },
                gameManager: gameData
            };

            // Check if file already exists
            const existingFiles = await gapi.client.drive.files.list({
                q: `name='${fileName}' and parents in '${this.appFolderId}' and trashed=false`,
                spaces: 'drive'
            });

            const boundary = '-------314159265358979323846';
            const delimiter = "\r\n--" + boundary + "\r\n";
            const close_delim = "\r\n--" + boundary + "--";

            // Only include parents on POST (create)
            let metadata = { name: fileName };
            let method = 'POST';
            let url = 'https://www.googleapis.com/upload/drive/v3/files';
            if (existingFiles.result.files.length > 0) {
                // PATCH: do NOT include parents
                url += '/' + existingFiles.result.files[0].id;
                method = 'PATCH';
            } else {
                // POST: include parents for creation
                metadata.parents = [this.appFolderId];
            }

            const multipartRequestBody =
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(metadata) +
                delimiter +
                'Content-Type: application/json\r\n\r\n' +
                JSON.stringify(dataToUpload, null, 2) +
                close_delim;

            const response = await gapi.client.request({
                path: url,
                method: method,
                params: {'uploadType': 'multipart'},
                headers: {
                    'Content-Type': 'multipart/related; boundary="' + boundary + '"'
                },
                body: multipartRequestBody
            });

            cloudConfig.lastSyncTime = new Date().toISOString();
            console.log('Game data uploaded successfully:', response.result);
            return response.result;
        } catch (error) {
            console.error('Failed to upload game data:', error);
            throw error;
        }
    }

    async downloadGameData() {
        if (!this.isSignedIn || !this.appFolderId || typeof gapi === 'undefined' || !gapi.client) {
            throw new Error('Not authenticated or Google Drive API not available');
        }

        try {
            const fileName = 'games-data.json';
            const response = await gapi.client.drive.files.list({
                q: `name='${fileName}' and parents in '${this.appFolderId}' and trashed=false`,
                spaces: 'drive'
            });

            if (response.result.files.length === 0) {
                console.log('No game data found in Google Drive');
                return null;
            }

            const fileId = response.result.files[0].id;
            const fileContent = await gapi.client.drive.files.get({
                fileId: fileId,
                alt: 'media'
            });

            const gameData = JSON.parse(fileContent.body);
            console.log('Game data downloaded successfully');
            return gameData;
        } catch (error) {
            console.error('Failed to download game data:', error);
            throw error;
        }
    }

    async downloadAndMergeGameData() {
        try {
            showSyncProgress('正在下載雲端數據...', 25);
            
            const cloudData = await this.downloadGameData();
            if (!cloudData || !cloudData.gameManager) {
                showSyncProgress('', 0);
                return;
            }

            showSyncProgress('正在合併數據...', 75);

            // Check for conflicts
            const hasConflicts = this.detectConflicts(gameManager, cloudData.gameManager);
            
            if (hasConflicts) {
                showSyncProgress('', 0);
                this.showConflictResolution(gameManager, cloudData.gameManager);
                return;
            }

            // Merge data
            const mergedData = this.mergeGameData(gameManager, cloudData.gameManager);
            gameManager = mergedData;

            showSyncProgress('同步完成', 100);
            setTimeout(() => showSyncProgress('', 0), 1000);

            updateGamesList();
            updateGamesSelectionList();
            showNotification('雲端數據同步成功', 'success');
        } catch (error) {
            showSyncProgress('', 0);
            this.handleSyncError(error);
        }
    }

    detectConflicts(localData, cloudData) {
        if (!localData.games || !cloudData.games) return false;

        for (const gameId in localData.games) {
            if (cloudData.games[gameId]) {
                const localGame = localData.games[gameId];
                const cloudGame = cloudData.games[gameId];
                
                const localTime = new Date(localGame.lastModified);
                const cloudTime = new Date(cloudGame.lastModified);
                
                // Consider conflict if both have been modified and difference is less than 1 minute
                if (Math.abs(localTime - cloudTime) > 60000 && localTime > cloudTime) {
                    return true;
                }
            }
        }
        return false;
    }

    mergeGameData(localData, cloudData) {
        const merged = { ...localData };
        
        if (!cloudData.games) return merged;

        for (const gameId in cloudData.games) {
            if (!merged.games[gameId]) {
                // Game only exists in cloud
                merged.games[gameId] = cloudData.games[gameId];
            } else {
                // Game exists in both, use the one with later modification time
                const localTime = new Date(merged.games[gameId].lastModified);
                const cloudTime = new Date(cloudData.games[gameId].lastModified);
                
                if (cloudTime > localTime) {
                    merged.games[gameId] = cloudData.games[gameId];
                }
            }
        }

        return merged;
    }

    showConflictResolution(localData, cloudData) {
        const modal = document.getElementById('conflictModal');
        const localInfo = document.getElementById('localVersionInfo');
        const cloudInfo = document.getElementById('cloudVersionInfo');

        if (localInfo) {
            const localTime = this.getLatestModificationTime(localData);
            localInfo.textContent = `最後修改：${formatDateTime(localTime)}`;
        }

        if (cloudInfo) {
            const cloudTime = this.getLatestModificationTime(cloudData);
            cloudInfo.textContent = `最後修改：${formatDateTime(cloudTime)}`;
        }

        window.conflictData = { local: localData, cloud: cloudData };
        
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    getLatestModificationTime(data) {
        if (!data.games) return new Date().toISOString();
        
        let latest = new Date(0);
        for (const gameId in data.games) {
            const gameTime = new Date(data.games[gameId].lastModified);
            if (gameTime > latest) {
                latest = gameTime;
            }
        }
        return latest.toISOString();
    }

    async syncWithCloud() {
        if (!this.isSignedIn) {
            showNotification('請先登入 Google Drive', 'warning');
            return false;
        }

        try {
            showSyncProgress('正在上傳數據...', 50);
            await this.uploadGameData(gameManager);
            showSyncProgress('同步完成', 100);
            setTimeout(() => showSyncProgress('', 0), 1000);
            showNotification('雲端同步成功', 'success');
            return true;
        } catch (error) {
            showSyncProgress('', 0);
            this.handleSyncError(error);
            return false;
        }
    }

    handleSyncError(error) {
        console.error('Sync error:', error);

        let errorMessage = '同步失敗，請檢查網路連線';
        if (error.status === 401) {
            errorMessage = '認證已過期，請重新登入';
            this.signOut();
        } else if (error.status === 403) {
            // Try to get detailed error message from Google
            if (error.result && error.result.error && error.result.error.message) {
                errorMessage = 'Google Drive 錯誤: ' + error.result.error.message;
            } else {
                errorMessage = 'Google Drive 權限錯誤，請確認權限與設定';
            }
        } else if (error.status === 404) {
            errorMessage = '雲端檔案不存在，將創建新備份';
        } else if (!navigator.onLine) {
            errorMessage = '網路連線中斷，將在恢復後自動同步';
            this.showOfflineMode();
        }
        showNotification(errorMessage, error.status === 403 ? 'warning' : 'error');
        updateSyncStatus('error');
    }
    
    showOfflineMode() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
    }

    hideOfflineMode() {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    getDeviceId() {
        let deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        try {
            const stored = localStorage.getItem('deviceId');
            if (stored) {
                deviceId = stored;
            } else {
                localStorage.setItem('deviceId', deviceId);
            }
        } catch (e) {
            // localStorage not available
        }
        return deviceId;
    }
}

// Auto Sync Class
class AutoSync {
    constructor(interval = 300000) { // 5 minutes
        this.interval = interval;
        this.timer = null;
        this.isRunning = false;
    }

    start() {
        if (this.isRunning || !googleDriveManager.isSignedIn) return;
        
        this.isRunning = true;
        this.timer = setInterval(async () => {
            if (googleDriveManager.isSignedIn && gameManager.hasUnsavedChanges) {
                console.log('Auto-syncing to Google Drive...');
                const success = await googleDriveManager.syncWithCloud();
                if (success) {
                    gameManager.hasUnsavedChanges = false;
                }
            }
        }, this.interval);
        
        console.log('Auto-sync started');
    }

    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isRunning = false;
        console.log('Auto-sync stopped');
    }
}

// Initialize Google Drive Manager and Auto Sync
const googleDriveManager = new GoogleDriveManager();
const autoSync = new AutoSync();

// Game State Management
let gameManager = {
    games: {
        'game_20250821_001': {
            id: 'game_20250821_001',
            name: '週五麻將局',
            creator: 'John',
            createdAt: '2025-08-21T08:58:00.000Z',
            lastModified: '2025-08-21T08:58:00.000Z',
            lastEditor: 'John',
            playerCount: 4,
            roundCount: 8,
            cloudFileId: null,
            lastCloudSync: null,
            syncStatus: 'pending',
            gameData: {
                players: [
                    {id: 1, name: 'John', totalWinLoss: 150, bankerRounds: 2},
                    {id: 2, name: 'Mary', totalWinLoss: -50, bankerRounds: 2},
                    {id: 3, name: 'Peter', totalWinLoss: -80, bankerRounds: 2},
                    {id: 4, name: 'Lisa', totalWinLoss: -20, bankerRounds: 2}
                ],
                currentRound: 9,
                currentBankerId: null,
                defaultBankerRounds: 3,
                customBankerRounds: 3,
                rounds: [],
                gameStarted: true,
                nextPlayerId: 5,
                gameCreatedAt: '2025-08-21T08:58:00.000Z',
                lastModified: '2025-08-21T08:58:00.000Z'
            }
        },
        'game_20250821_002': {
            id: 'game_20250821_002',
            name: '週末德州撲克',
            creator: 'Alice',
            createdAt: '2025-08-21T10:30:00.000Z',
            lastModified: '2025-08-21T10:30:00.000Z',
            lastEditor: 'Alice',
            playerCount: 6,
            roundCount: 12,
            cloudFileId: null,
            lastCloudSync: null,
            syncStatus: 'pending',
            gameData: {
                players: [],
                currentRound: 1,
                currentBankerId: null,
                defaultBankerRounds: 3,
                customBankerRounds: 3,
                rounds: [],
                gameStarted: false,
                nextPlayerId: 1,
                gameCreatedAt: '2025-08-21T10:30:00.000Z',
                lastModified: '2025-08-21T10:30:00.000Z'
            }
        }
    },
    currentGameId: null,
    currentUser: 'John',
    hasUnsavedChanges: false
};

// Initialize a game state with both players (currently in game) and allPlayers (all ever joined)
function createInitialGameData() {
    return {
        players: [],
        allPlayers: [], // master list of all players who have ever joined
        currentRound: 1,
        currentBankerId: null,
        defaultBankerRounds: 3,
        customBankerRounds: 3,
        rounds: [],
        gameStarted: false,
        nextPlayerId: 1,
        gameCreatedAt: new Date().toISOString(),
        lastModified: new Date().toISOString()
    };
}


let cloudConfig = {
    provider: 'googledrive',
    autoSyncInterval: 300000,
    lastSyncTime: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    syncEnabled: true,
    isConfigured: true
};

// Current game state (for backward compatibility)
let gameState = null;
let currentScreen = 'welcome';
let currentRecordingPlayerId = null;
let editingRecord = { roundNumber: null, playerId: null };

// Google Drive API Functions - Updated for GIS
window.signInGoogle = function() {
    console.log('📱 Sign in button clicked');
    googleDriveManager.signIn();
};

window.signOutGoogle = function() {
    console.log('Sign out button clicked');
    googleDriveManager.signOut();
};

async function manualSyncWithCloud() {
    if (!googleDriveManager.isSignedIn) {
        showNotification('請先登入 Google Drive', 'warning');
        return;
    }
    
    updateCloudSyncStatus('syncing');
    const success = await googleDriveManager.syncWithCloud();
    updateCloudSyncStatus(success ? 'success' : 'error');
}

function updateCloudSyncStatus(status = 'success') {
    const element = document.getElementById('cloudSyncStatus');
    const textElement = document.getElementById('cloudSyncText');
    
    if (!element || !textElement) return;
    
    element.className = 'cloud-sync-status';
    
    if (status === 'syncing') {
        element.classList.add('syncing');
        textElement.textContent = '正在同步雲端...';
    } else if (status === 'error') {
        element.classList.add('error');
        textElement.textContent = '雲端同步失敗';
    } else {
        const lastSync = new Date(cloudConfig.lastSyncTime);
        const minutesAgo = Math.floor((Date.now() - lastSync.getTime()) / 60000);
        textElement.textContent = googleDriveManager.isSignedIn ? 
            (minutesAgo < 1 ? '雲端已同步' : `${minutesAgo}分鐘前同步`) : 
            '未登入Google Drive';
    }
}

function showSyncProgress(text, percentage) {
    const progressDiv = document.getElementById('syncProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (!progressDiv) return;
    
    if (text && percentage > 0) {
        progressDiv.style.display = 'block';
        if (progressFill) progressFill.style.width = percentage + '%';
        if (progressText) progressText.textContent = text;
    } else {
        progressDiv.style.display = 'none';
    }
}

// Conflict Resolution Functions
function resolveConflict(choice) {
    if (!window.conflictData) return;
    
    if (choice === 'local') {
        // Keep local data, upload to cloud
        googleDriveManager.syncWithCloud();
        showNotification('已保留本地版本並上傳至雲端', 'success');
    } else if (choice === 'cloud') {
        // Use cloud data
        gameManager = window.conflictData.cloud;
        updateGamesList();
        updateGamesSelectionList();
        showNotification('已使用雲端版本', 'success');
    }
    
    delete window.conflictData;
    closeConflictModal();
}

function closeConflictModal() {
    const modal = document.getElementById('conflictModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

// Settings Functions
function toggleGoogleDriveSync() {
    if (googleDriveManager.isSignedIn) {
        googleDriveManager.signOut();
    } else {
        googleDriveManager.signIn();
    }
}

function updateGoogleDriveSettings() {
    const toggleButton = document.getElementById('googleDriveToggle');
    const lastSyncElement = document.getElementById('lastSyncTime');
    
    if (toggleButton) {
        toggleButton.textContent = googleDriveManager.isSignedIn ? '停用' : '啟用';
        toggleButton.className = googleDriveManager.isSignedIn ? 'btn btn--sm btn--secondary' : 'btn btn--sm btn--primary';
    }
    
    if (lastSyncElement) {
        if (googleDriveManager.isSignedIn && cloudConfig.lastSyncTime) {
            const lastSync = new Date(cloudConfig.lastSyncTime);
            const minutesAgo = Math.floor((Date.now() - lastSync.getTime()) / 60000);
            lastSyncElement.textContent = minutesAgo < 1 ? '剛剛同步' : `${minutesAgo}分鐘前`;
        } else {
            lastSyncElement.textContent = '未同步';
        }
    }
}

// Utility Functions
function generateGameId() {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `game_${timestamp}_${random}`;
}

function formatDateTime(isoString) {
    return new Date(isoString).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('zh-TW');
}

function isGameLocked(game) {
    if (!game.isLocked) return false;
    if (!game.lockExpiry) return false;
    return new Date() < new Date(game.lockExpiry);
}

// Screen Navigation Functions - Fixed
function showScreen(screenId) {
    console.log('Showing screen:', screenId);
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.add('hidden');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        currentScreen = screenId;
        console.log('Successfully switched to screen:', screenId);
    } else {
        console.error('Screen not found:', screenId);
    }
    
    updateBottomNavigation();
}

function updateBottomNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    if (currentScreen === 'recordScreen') {
        navItems[0]?.classList.add('active');
    } else if (currentScreen === 'detailedRecordsScreen') {
        navItems[1]?.classList.add('active');
    } else if (currentScreen === 'statisticsScreen') {
        navItems[2]?.classList.add('active');
    } else if (currentScreen === 'settingsScreen') {
        navItems[3]?.classList.add('active');
    }
}

// Navigation Functions - Fixed
window.showWelcome = function() {
    console.log('Showing welcome screen');
    showScreen('welcomeScreen');
    updateSyncStatus();
};

window.showGameManagement = function() {
    console.log('Showing game management screen');
    showScreen('gameManagementScreen');
    updateGamesList();
    updateCloudSyncStatus();
};

window.showGameList = function() {
    console.log('Showing game list screen');
    showScreen('gameListScreen');
    updateGamesSelectionList();
};

window.backToGameManagement = function() {
    if (gameManager.currentGameId) {
        showGameManagement();
    } else {
        showWelcome();
    }
};

// Game Management Functions
function updateGamesList() {
    const container = document.getElementById('gamesList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const games = Object.values(gameManager.games);
    if (games.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>尚無遊戲</h3>
                <p>點擊「創建新遊戲」開始第一個遊戲</p>
            </div>
        `;
        return;
    }
    
    games.forEach(game => {
        const gameDiv = document.createElement('div');
        const locked = isGameLocked(game);
        const syncing = game.syncStatus === 'syncing';
        
        gameDiv.className = `game-card ${locked ? 'locked' : ''} ${syncing ? 'syncing' : ''}`;
        gameDiv.onclick = () => selectGame(game.id);
        
        let statusText = '可編輯';
        if (locked) {
            statusText = `正被 ${game.lockHolder} 編輯中`;
        } else if (syncing) {
            statusText = '正在同步中';
        }
        
        gameDiv.innerHTML = `
            ${locked ? '<div class="lock-indicator">🔒</div>' : ''}
            ${syncing ? '<div class="sync-indicator-card">☁️</div>' : ''}
            <div class="game-header">
                <h3 class="game-title">${game.name}</h3>
            </div>
            <div class="game-meta">
                <div class="game-meta-item">
                    <span class="meta-label">創建者</span>
                    <span>${game.creator}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">玩家數</span>
                    <span>${game.playerCount} 人</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">創建時間</span>
                    <span>${formatDate(game.createdAt)}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">最後修改</span>
                    <span>${formatDate(game.lastModified)}</span>
                </div>
            </div>
            <div class="game-status ${locked ? 'locked' : syncing ? 'syncing' : 'available'}">
                ${statusText}
            </div>
        `;
        container.appendChild(gameDiv);
    });
}

// Update game list rendering to remove lock logic:
function updateGamesList() {
    const container = document.getElementById('gamesList');
    if (!container) return;
    container.innerHTML = '';
    const games = Object.values(gameManager.games);
    if (games.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>尚無遊戲</h3>
                <p>點擊「創建新遊戲」開始第一個遊戲</p>
            </div>
        `;
        return;
    }
    games.forEach(game => {
        const gameDiv = document.createElement('div');
        const syncing = game.syncStatus === 'syncing';
        gameDiv.className = `game-card ${syncing ? 'syncing' : ''}`;
        gameDiv.onclick = () => selectGame(game.id);
        let statusText = '可編輯';
        if (syncing) {
            statusText = '正在同步中';
        }
        gameDiv.innerHTML = `
            ${syncing ? '<div class="sync-indicator-card">☁️</div>' : ''}
            <div class="game-header">
                <h3 class="game-title">${game.name}</h3>
            </div>
            <div class="game-meta">
                <div class="game-meta-item">
                    <span class="meta-label">創建者</span>
                    <span>${game.creator}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">玩家數</span>
                    <span>${game.playerCount} 人</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">創建時間</span>
                    <span>${formatDate(game.createdAt)}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">最後修改</span>
                    <span>${formatDate(game.lastModified)}</span>
                </div>
            </div>
            <div class="game-status ${syncing ? 'syncing' : 'available'}">
                ${statusText}
            </div>
        `;
        container.appendChild(gameDiv);
    });
}
function updateGamesSelectionList() {
    const container = document.getElementById('gamesSelectionList');
    if (!container) return;
    container.innerHTML = '';
    const games = Object.values(gameManager.games);
    if (games.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>尚無遊戲</h3>
                <p>返回首頁創建您的第一個遊戲</p>
            </div>
        `;
        return;
    }
    games.forEach(game => {
        const gameDiv = document.createElement('div');
        gameDiv.className = `game-card`;
        gameDiv.onclick = () => selectAndStartGame(game.id);
        gameDiv.innerHTML = `
            <div class="game-header">
                <h3 class="game-title">${game.name}</h3>
            </div>
            <div class="game-meta">
                <div class="game-meta-item">
                    <span class="meta-label">創建者</span>
                    <span>${game.creator}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">輪數</span>
                    <span>${game.roundCount} 輪</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">創建時間</span>
                    <span>${formatDate(game.createdAt)}</span>
                </div>
                <div class="game-meta-item">
                    <span class="meta-label">最後修改</span>
                    <span>${formatDate(game.lastModified)}</span>
                </div>
            </div>
            <div class="game-status available">
                點擊繼續遊戲
            </div>
        `;
        container.appendChild(gameDiv);
    });
}

function selectGame(gameId) {
    const game = gameManager.games[gameId];
    if (!game) return;
    gameManager.currentGameId = gameId;
    gameState = game.gameData;
    if (gameState.gameStarted && gameState.rounds.length > 0) {
        showRecord();
    } else if (gameState.gameStarted) {
        showBankerSelection();
    } else {
        showPlayerSetup();
    }
}

function selectAndStartGame(gameId) {
    selectGame(gameId);
}


// Game Lock Management
function acquireGameLock(gameId) {
    const game = gameManager.games[gameId];
    if (!game) return;
    
    if (isGameLocked(game) && game.lockHolder !== gameManager.currentUser) {
        throw new Error(`遊戲正被 ${game.lockHolder} 編輯中`);
    }
    
    game.isLocked = true;
    game.lockExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
    game.lockHolder = gameManager.currentUser;
    
    autoSave();
    updateGameLockStatus();
    
    // Auto-refresh lock every 10 minutes
    setTimeout(() => {
        if (gameManager.currentGameId === gameId && currentScreen !== 'welcome') {
            refreshGameLock(gameId);
        }
    }, 10 * 60 * 1000);
}

function refreshGameLock(gameId) {
    const game = gameManager.games[gameId];
    if (!game || !game.isLocked || game.lockHolder !== gameManager.currentUser) return;
    
    game.lockExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    autoSave();
    updateGameLockStatus();
}

function releaseGameLock(gameId) {
    const game = gameManager.games[gameId];
    if (!game) return;
    
    game.isLocked = false;
    game.lockExpiry = null;
    game.lockHolder = null;
    
    autoSave();
}

function updateGameLockStatus() {
    const statusEl = document.getElementById('gameLockStatus');
    if (!statusEl || !gameManager.currentGameId) return;
    
    const game = gameManager.games[gameManager.currentGameId];
    if (!game) return;
    
    if (game.isLocked && game.lockHolder === gameManager.currentUser) {
        const lockExpiry = new Date(game.lockExpiry);
        const timeLeft = Math.floor((lockExpiry - new Date()) / 60000); // minutes
        
        statusEl.className = 'game-lock-status';
        statusEl.innerHTML = `您正在編輯此遊戲 (${timeLeft} 分鐘後自動釋放)`;
        statusEl.style.display = 'block';
        
        if (timeLeft <= 3) {
            statusEl.className = 'game-lock-status warning';
            statusEl.innerHTML = `注意：編輯權限將在 ${timeLeft} 分鐘後過期`;
        }
    } else {
        statusEl.style.display = 'none';
    }
}

// Create Game Functions - Fixed
window.createNewGame = function() {
    console.log('Creating new game...');
    const modal = document.getElementById('createGameModal');
    const nameInput = document.getElementById('gameNameInput');
    const creatorInput = document.getElementById('creatorNameInput');
    
    if (nameInput) nameInput.value = '';
    if (creatorInput) creatorInput.value = gameManager.currentUser;
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if (nameInput) nameInput.focus();
        }, 100);
    }
};

window.closeCreateGameModal = function() {
    const modal = document.getElementById('createGameModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.confirmCreateGame = function() {
    const nameInput = document.getElementById('gameNameInput');
    const creatorInput = document.getElementById('creatorNameInput');
    
    const gameName = nameInput?.value.trim();
    const creatorName = creatorInput?.value.trim();
    
    if (!gameName) {
        showNotification('請輸入遊戲名稱', 'error');
        return;
    }
    
    if (!creatorName) {
        showNotification('請輸入創建者名稱', 'error');
        return;
    }
    
    // Check if game name already exists
    const existingGame = Object.values(gameManager.games).find(g => g.name === gameName);
    if (existingGame) {
        showNotification('遊戲名稱已存在', 'error');
        return;
    }
    
    const gameId = generateGameId();
    const now = new Date().toISOString();
    
    const newGame = {
        id: gameId,
        name: gameName,
        creator: creatorName,
        createdAt: now,
        lastModified: now,
        lastEditor: creatorName,
        isLocked: false,
        lockExpiry: null,
        lockHolder: null,
        playerCount: 0,
        roundCount: 0,
        cloudFileId: null,
        lastCloudSync: null,
        syncStatus: 'pending',
        gameData: {
            players: [],
            currentRound: 1,
            currentBankerId: null,
            defaultBankerRounds: 3,
            customBankerRounds: 3,
            rounds: [],
            gameStarted: false,
            nextPlayerId: 1,
            gameCreatedAt: now,
            lastModified: now
        }
    };
    
    gameManager.games[gameId] = newGame;
    gameManager.currentGameId = gameId;
    gameState = newGame.gameData;
    
    autoSave();
    closeCreateGameModal();
    showPlayerSetup();
    showNotification('遊戲創建成功', 'success');
};

// Cloud Sync Functions
function syncWithCloud() {
    return manualSyncWithCloud();
}

function updateSyncStatus(status = 'success') {
    const indicator = document.getElementById('syncIndicator');
    const statusText = document.getElementById('syncStatusText');
    
    if (!indicator || !statusText) return;
    
    indicator.className = 'sync-indicator';
    
    if (status === 'connecting') {
        indicator.classList.add('syncing');
        statusText.textContent = '正在連接...';
    } else if (status === 'syncing') {
        indicator.classList.add('syncing');
        statusText.textContent = '同步中...';
    } else if (status === 'error') {
        indicator.classList.add('error');
        statusText.textContent = '連接失敗';
    } else if (status === 'signed_out') {
        indicator.classList.add('offline');
        statusText.textContent = '未登入Google Drive';
    } else if (!googleDriveManager.isSignedIn) {
        indicator.classList.add('offline');
        statusText.textContent = '未登入Google Drive';
    } else {
        const lastSync = new Date(cloudConfig.lastSyncTime);
        const minutesAgo = Math.floor((Date.now() - lastSync.getTime()) / 60000);
        statusText.textContent = minutesAgo < 1 ? '雲端已同步' : `${minutesAgo}分鐘前同步`;
    }
}

function autoSave() {
    // Update game metadata
    if (gameManager.currentGameId && gameState) {
        const currentGame = gameManager.games[gameManager.currentGameId];
        if (currentGame) {
            currentGame.lastModified = new Date().toISOString();
            currentGame.lastEditor = gameManager.currentUser;
            currentGame.playerCount = gameState.players.length;
            currentGame.roundCount = gameState.rounds.length;
            currentGame.gameData = { ...gameState };
            
            // Mark as having unsaved changes
            gameManager.hasUnsavedChanges = true;
        }
    }
    
    console.log('Game auto-saved');
}

// Player Setup Functions
function showPlayerSetup() {
    console.log('Showing player setup screen');
    showScreen('playerSetupScreen');
    updateCurrentGameTitle();
    updateBankerRoundsDisplay();
    updatePlayerList();
    updateConfirmButton();
}

function updateCurrentGameTitle() {
    const titleEl = document.getElementById('currentGameTitle');
    if (titleEl && gameManager.currentGameId) {
        const game = gameManager.games[gameManager.currentGameId];
        titleEl.textContent = game ? game.name : '新遊戲';
    }
}

// --- PLAYER MANAGEMENT --- //

// Add Player (with support for rejoin and persistent record)
window.addPlayer = function() {
    console.log('Adding player...');
    const input = document.getElementById('playerNameInput');
    if (!input || !gameState) {
        console.error('Player name input not found or no game state');
        return;
    }
    const name = input.value.trim();
    if (name === '') {
        showNotification('請輸入玩家名稱', 'error');
        return;
    }

    // Check if player with this name exists in allPlayers (master list)
    let player = (gameState.allPlayers || []).find(p => p.name === name);
    if (player) {
        // Already played before
        if (gameState.players.some(p => p.id === player.id)) {
            showNotification('玩家名稱已存在', 'error');
            return;
        }
        // Rejoin, add to current players
        gameState.players.push(player);
    } else {
        // New player
        player = {
            id: gameState.nextPlayerId++,
            name: name,
            totalWinLoss: 0,
            bankerRounds: 0
        };
        gameState.players.push(player);
        // Add to allPlayers master list
        if (!gameState.allPlayers) gameState.allPlayers = [];
        gameState.allPlayers.push(player);
    }
    input.value = '';
    updatePlayerList();
    updateConfirmButton();
    autoSave();
};

// Remove Player (from current game only, keep record in allPlayers)
window.removePlayer = function(playerId) {
    if (!gameState) return;
    console.log('Removing player:', playerId);
    gameState.players = gameState.players.filter(player => player.id !== playerId);
    updatePlayerList();
    updateConfirmButton();
    autoSave();
};

// List all current players
function updatePlayerList() {
    const container = document.getElementById('playerList');
    if (!container || !gameState) return;
    container.innerHTML = '';
    gameState.players.forEach(player => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.innerHTML = `
            <span class="player-name">${player.name}</span>
            <button class="remove-player" onclick="removePlayer(${player.id})">移除</button>
        `;
        container.appendChild(playerDiv);
    });
}

// Confirm players (must have at least 2)
function updateConfirmButton() {
    const btn = document.getElementById('confirmPlayersBtn');
    if (!btn || !gameState) return;
    const canConfirm = gameState.players.length >= 2;
    btn.disabled = !canConfirm;
    btn.textContent = canConfirm ? `確認玩家 (${gameState.players.length}人)` : '確認玩家 (最少2人)';
}

window.confirmPlayers = function() {
    console.log('Confirming players...');
    if (!gameState || gameState.players.length < 2) {
        showNotification('至少需要2位玩家', 'error');
        return;
    }
    
    gameState.gameStarted = true;
    gameState.gameCreatedAt = new Date().toISOString();
    gameState.lastModified = new Date().toISOString();
    autoSave();
    showBankerSelection();
};

// Settings Functions
window.showSettings = function() {
    console.log('Showing settings screen');
    showScreen('settingsScreen');
    updateSettingsDisplay();
    updateGoogleDriveSettings();
};

function updateSettingsDisplay() {
    const bankerSelect = document.getElementById('bankerRoundsSelect');
    const userInput = document.getElementById('userNameInput');
    
    if (bankerSelect && gameState) {
        bankerSelect.value = gameState.customBankerRounds.toString();
    }
    
    if (userInput) {
        userInput.value = gameManager.currentUser;
    }
}

window.updateBankerRounds = function(rounds) {
    if (!gameState) return;
    
    gameState.customBankerRounds = parseInt(rounds);
    gameState.defaultBankerRounds = parseInt(rounds);
    updateBankerRoundsDisplay();
    autoSave();
};

window.updateUserName = function(name) {
    if (name.trim()) {
        gameManager.currentUser = name.trim();
        autoSave();
    }
};

function updateBankerRoundsDisplay() {
    const display = document.getElementById('currentBankerRounds');
    if (display && gameState) {
        display.textContent = gameState.customBankerRounds;
    }
}

window.goBackFromSettings = function() {
    if (gameState && gameState.gameStarted && gameState.rounds.length > 0) {
        showRecord();
    } else if (gameState && gameState.gameStarted) {
        showBankerSelection();
    } else {
        showPlayerSetup();
    }
};

// Banker Selection Functions
function showBankerSelection() {
    console.log('Showing banker selection screen');
    showScreen('bankerSelectionScreen');
    updateBankerList();
    const currentRoundEl = document.getElementById('currentRoundNumber');
    if (currentRoundEl && gameState) {
        currentRoundEl.textContent = gameState.currentRound;
    }
}

function updateBankerList() {
    const container = document.getElementById('bankerList');
    if (!container || !gameState) return;
    
    container.innerHTML = '';
    
    gameState.players.forEach(player => {
        const bankerDiv = document.createElement('div');
        bankerDiv.className = 'banker-item';
        bankerDiv.onclick = () => selectBanker(player.id);
        
        const totalClass = player.totalWinLoss > 0 ? 'positive' : player.totalWinLoss < 0 ? 'negative' : '';
        
        bankerDiv.innerHTML = `
            <div class="banker-info">
                <div class="banker-name">${player.name}</div>
                <div class="banker-rounds">已當莊: ${player.bankerRounds} 輪</div>
            </div>
            <div class="banker-total ${totalClass}">
                總計: ${player.totalWinLoss >= 0 ? '+' : ''}${player.totalWinLoss}
            </div>
        `;
        container.appendChild(bankerDiv);
    });
}

window.selectBanker = function(playerId) {
    console.log('Selecting banker:', playerId);
    if (!gameState) return;
    
    gameState.currentBankerId = playerId;
    
    const banker = gameState.players.find(p => p.id === playerId);
    if (!banker) {
        console.error('Banker not found:', playerId);
        return;
    }
    
    const currentRound = {
        roundNumber: gameState.currentRound,
        bankerId: playerId,
        bankerName: banker.name,
        records: []
    };
    
    gameState.players.forEach(player => {
        if (player.id !== playerId) {
            currentRound.records.push({
                playerId: player.id,
                playerName: player.name,
                amount: 0,
                completed: false
            });
        }
    });
    
    const existingRoundIndex = gameState.rounds.findIndex(r => r.roundNumber === gameState.currentRound);
    if (existingRoundIndex >= 0) {
        gameState.rounds[existingRoundIndex] = currentRound;
    } else {
        gameState.rounds.push(currentRound);
    }
    
    gameState.lastModified = new Date().toISOString();
    autoSave();
    showRecord();
};

window.goBackFromBankerSelection = function() {
    if (!gameState) return;
    
    if (gameState.rounds.length === 0) {
        showPlayerSetup();
    } else {
        showRecord();
    }
};

// Record Screen Functions
function showRecord() {
    console.log('Showing record screen');
    showScreen('recordScreen');
    updateRecordScreen();
    updateGameLockStatus();
}

window.showRecord = showRecord;

function updateRecordScreen() {
    if (!gameState) return;
    
    const roundNumberEl = document.getElementById('recordRoundNumber');
    if (roundNumberEl) {
        roundNumberEl.textContent = gameState.currentRound;
    }
    
    const banker = gameState.players.find(p => p.id === gameState.currentBankerId);
    const bankerNameEl = document.getElementById('currentBankerName');
    if (bankerNameEl) {
        bankerNameEl.textContent = banker ? banker.name : '';
    }
    
    const container = document.getElementById('playerRecordList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (!currentRound) return;
    
    currentRound.records.forEach(record => {
        const recordDiv = document.createElement('div');
        recordDiv.className = `record-item ${record.completed ? 'completed' : 'pending'}`;
        recordDiv.onclick = () => openAmountModal(record.playerId);
        
        const amountClass = record.amount > 0 ? 'positive' : record.amount < 0 ? 'negative' : '';
        const statusText = record.completed ? '已完成' : '待記錄';
        const statusClass = record.completed ? 'completed' : '';
        
        recordDiv.innerHTML = `
            <div class="record-player-info">
                <div class="record-player-name">${record.playerName}</div>
                <div class="record-status ${statusClass}">${statusText}</div>
            </div>
            <div class="record-amount">
                <div class="amount-value ${amountClass}">
                    ${record.completed ? (record.amount >= 0 ? '+' : '') + record.amount : '---'}
                </div>
            </div>
        `;
        container.appendChild(recordDiv);
    });
    
    updateNextRoundButton();
    addFloatingActionButton();
}

function updateNextRoundButton() {
    const btn = document.getElementById('nextRoundBtn');
    if (!btn || !gameState) return;
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    
    if (!currentRound) {
        btn.disabled = true;
        return;
    }
    
    const allCompleted = currentRound.records.every(record => record.completed);
    btn.disabled = !allCompleted;
}

function addFloatingActionButton() {
    // Remove existing button
    const existingBtn = document.querySelector('.add-player-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    if (currentScreen === 'recordScreen') {
        const addBtn = document.createElement('button');
        addBtn.className = 'add-player-btn';
        addBtn.innerHTML = '+';
        addBtn.onclick = openAddPlayerModal;
        document.body.appendChild(addBtn);
    }
}

// Next Round Logic
window.nextRound = function() {
    if (!gameState) return;
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (!currentRound) return;
    
    const bankerTotal = currentRound.records.reduce((sum, record) => sum - record.amount, 0);
    
    currentRound.records.forEach(record => {
        const player = gameState.players.find(p => p.id === record.playerId);
        if (player) {
            player.totalWinLoss += record.amount;
        }
    });
    
    const banker = gameState.players.find(p => p.id === gameState.currentBankerId);
    if (banker) {
        banker.totalWinLoss += bankerTotal;
        banker.bankerRounds++;
    }
    
    gameState.currentRound++;
    gameState.lastModified = new Date().toISOString();
    autoSave();

    // --- ADDED: Immediately upload to cloud after next round ---
    if (googleDriveManager.isSignedIn) {
        googleDriveManager.syncWithCloud();
    }
    // ----------------------------------------------------------

    if (banker && banker.bankerRounds % gameState.customBankerRounds === 0) {
        gameState.currentBankerId = null;
        showBankerSelection();
    } else {
        selectBanker(gameState.currentBankerId);
    }
};

// Modal Functions (Amount Input)
function openAmountModal(playerId) {
    if (!gameState) return;
    
    currentRecordingPlayerId = playerId;
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    const record = currentRound.records.find(r => r.playerId === playerId);
    
    const modalTitle = document.getElementById('modalTitle');
    const amountInput = document.getElementById('amountInput');
    const modal = document.getElementById('amountModal');
    
    if (modalTitle && record) {
        modalTitle.textContent = `記錄 ${record.playerName} 的輸贏`;
    }
    
    if (amountInput) {
        amountInput.value = record && record.completed ? record.amount : '';
    }
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if (amountInput) {
                amountInput.focus();
            }
        }, 100);
    }
}

window.closeAmountModal = function() {
    const modal = document.getElementById('amountModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentRecordingPlayerId = null;
};

window.confirmAmount = function() {
    const amountInput = document.getElementById('amountInput');
    if (!amountInput || !gameState) return;
    
    const amount = parseInt(amountInput.value);
    
    if (isNaN(amount)) {
        showNotification('請輸入有效的整數', 'error');
        return;
    }
    
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (!currentRound) return;
    
    const record = currentRound.records.find(r => r.playerId === currentRecordingPlayerId);
    if (!record) return;
    
    record.amount = amount;
    record.completed = true;
    
    gameState.lastModified = new Date().toISOString();
    autoSave();
    
    closeAmountModal();
    updateRecordScreen();
};

// Add Player Modal
function openAddPlayerModal() {
    const input = document.getElementById('newPlayerNameInput');
    const modal = document.getElementById('addPlayerModal');
    
    if (input) {
        input.value = '';
    }
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if (input) {
                input.focus();
            }
        }, 100);
    }
}

window.closeAddPlayerModal = function() {
    const modal = document.getElementById('addPlayerModal');
    if (modal) {
        modal.classList.add('hidden');
    }
};

window.confirmAddPlayer = function() {
    const input = document.getElementById('newPlayerNameInput');
    if (!input || !gameState) return;
    
    const name = input.value.trim();
    
    if (name === '') {
        showNotification('請輸入玩家名稱', 'error');
        return;
    }
    
    if (gameState.players.some(player => player.name === name)) {
        showNotification('玩家名稱已存在', 'error');
        return;
    }
    
    if (gameState.players.length >= 20) {
        showNotification('最多只能添加20位玩家', 'error');
        return;
    }
    
    const player = {
        id: gameState.nextPlayerId++,
        name: name,
        totalWinLoss: 0,
        bankerRounds: 0
    };
    
    gameState.players.push(player);
    
    // Add to current round if not banker
    const currentRound = gameState.rounds.find(r => r.roundNumber === gameState.currentRound);
    if (currentRound && player.id !== gameState.currentBankerId) {
        currentRound.records.push({
            playerId: player.id,
            playerName: player.name,
            amount: 0,
            completed: false
        });
    }
    
    gameState.lastModified = new Date().toISOString();
    autoSave();
    
    closeAddPlayerModal();
    updateRecordScreen();
};

// Detailed Records Functions
window.showDetailedRecords = function() {
    console.log('Showing detailed records screen');
    showScreen('detailedRecordsScreen');
    updateDetailedRecords();
};

function updateDetailedRecords() {
    console.log('Updating detailed records...');
    if (!gameState) return;
    
    const headerRow = document.getElementById('tableHeaderRow');
    const tableBody = document.getElementById('recordsTableBody');
    const totalsRow = document.getElementById('totalsRow');
    
    if (!headerRow || !tableBody || !totalsRow) {
        console.error('Table elements not found');
        return;
    }
    
    // Build header with player names
    headerRow.innerHTML = `
        <th>輪數</th>
        <th>莊家</th>
        ${gameState.players.map(player => `<th>${player.name}</th>`).join('')}
    `;
    
    // Build table body with round data
    let bodyHtml = '';
    gameState.rounds.forEach(round => {
        let rowHtml = `
            <tr>
                <td>${round.roundNumber}</td>
                <td>${round.bankerName}</td>
        `;
        
        gameState.players.forEach(player => {
            if (player.id === round.bankerId) {
                // Calculate banker's total for this round
                const bankerTotal = round.records.reduce((sum, record) => sum - record.amount, 0);
                const amountClass = bankerTotal > 0 ? 'positive' : bankerTotal < 0 ? 'negative' : '';
                rowHtml += `<td><span class="editable-amount ${amountClass}">莊家 (${bankerTotal >= 0 ? '+' : ''}${bankerTotal})</span></td>`;
            } else {
                // Find player's record for this round
                const record = round.records.find(r => r.playerId === player.id);
                const amount = record ? record.amount : 0;
                const amountClass = amount > 0 ? 'positive' : amount < 0 ? 'negative' : '';
                rowHtml += `<td><span class="editable-amount ${amountClass}" onclick="openEditRecordModal(${round.roundNumber}, ${player.id})">${amount >= 0 ? '+' : ''}${amount}</span></td>`;
            }
        });
        
        rowHtml += '</tr>';
        bodyHtml += rowHtml;
    });
    tableBody.innerHTML = bodyHtml;
    
    // Build totals row
    totalsRow.innerHTML = `
        <td><strong>總計</strong></td>
        <td>-</td>
        ${gameState.players.map(player => {
            const totalClass = player.totalWinLoss > 0 ? 'positive' : player.totalWinLoss < 0 ? 'negative' : '';
            return `<td><strong class="${totalClass}">${player.totalWinLoss >= 0 ? '+' : ''}${player.totalWinLoss}</strong></td>`;
        }).join('')}
    `;
}

// Edit Record Modal
window.openEditRecordModal = function(roundNumber, playerId) {
    if (!gameState) return;
    
    editingRecord.roundNumber = roundNumber;
    editingRecord.playerId = playerId;
    
    const round = gameState.rounds.find(r => r.roundNumber === roundNumber);
    const record = round?.records.find(r => r.playerId === playerId);
    const player = gameState.players.find(p => p.id === playerId);
    
    const modalTitle = document.getElementById('editModalTitle');
    const amountInput = document.getElementById('editAmountInput');
    const modal = document.getElementById('editRecordModal');
    
    if (modalTitle && player) {
        modalTitle.textContent = `編輯第${roundNumber}輪 - ${player.name}`;
    }
    
    if (amountInput && record) {
        amountInput.value = record.amount;
    }
    
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            if (amountInput) {
                amountInput.focus();
                amountInput.select();
            }
        }, 100);
    }
};

window.closeEditRecordModal = function() {
    const modal = document.getElementById('editRecordModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    editingRecord = { roundNumber: null, playerId: null };
};

window.confirmEditRecord = function() {
    const amountInput = document.getElementById('editAmountInput');
    if (!amountInput || !gameState) return;
    
    const amount = parseInt(amountInput.value);
    
    if (isNaN(amount)) {
        showNotification('請輸入有效的整數', 'error');
        return;
    }
    
    const round = gameState.rounds.find(r => r.roundNumber === editingRecord.roundNumber);
    if (!round) return;
    
    const record = round.records.find(r => r.playerId === editingRecord.playerId);
    if (!record) return;
    
    record.amount = amount;
    record.completed = true;
    
    // Recalculate player totals
    recalculatePlayerTotals();
    
    gameState.lastModified = new Date().toISOString();
    autoSave();
    
    closeEditRecordModal();
    updateDetailedRecords();
    showNotification('記錄已更新，總計重新計算', 'success');
};

function recalculatePlayerTotals() {
    if (!gameState) return;
    
    // Reset all totals
    gameState.players.forEach(player => {
        player.totalWinLoss = 0;
        player.bankerRounds = 0;
    });
    
    // Recalculate from all completed rounds
    gameState.rounds.forEach(round => {
        if (round.records.every(r => r.completed)) {
            const banker = gameState.players.find(p => p.id === round.bankerId);
            if (banker) {
                banker.bankerRounds++;
                const bankerTotal = round.records.reduce((sum, record) => sum - record.amount, 0);
                banker.totalWinLoss += bankerTotal;
            }
            
            round.records.forEach(record => {
                const player = gameState.players.find(p => p.id === record.playerId);
                if (player) {
                    player.totalWinLoss += record.amount;
                }
            });
        }
    });
}

// Statistics Functions
window.showStatistics = function() {
    console.log('Showing statistics screen');
    showScreen('statisticsScreen');
    updateStatistics();
};

function updateStatistics() {
    const container = document.getElementById('statisticsContent');
    if (!container || !gameState) return;
    
    container.innerHTML = '';
    
    const sortedPlayers = [...gameState.players].sort((a, b) => b.totalWinLoss - a.totalWinLoss);
    
    sortedPlayers.forEach(player => {
        const statsDiv = document.createElement('div');
        statsDiv.className = 'stats-item';
        
        const totalClass = player.totalWinLoss > 0 ? 'positive' : 
                          player.totalWinLoss < 0 ? 'negative' : 'neutral';
        
        statsDiv.innerHTML = `
            <div class="stats-player-info">
                <div class="stats-player-name">${player.name}</div>
                <div class="stats-banker-rounds">已當莊: ${player.bankerRounds} 輪</div>
            </div>
            <div class="stats-total">
                <div class="stats-total-amount ${totalClass}">
                    ${player.totalWinLoss >= 0 ? '+' : ''}${player.totalWinLoss}
                </div>
            </div>
        `;
        container.appendChild(statsDiv);
    });
}

window.goBackFromStatistics = function() {
    showRecord();
};

// Export Functions
window.exportToExcel = function() {
    try {
        if (typeof XLSX === 'undefined') {
            showNotification('Excel匯出功能不可用，請檢查網路連接', 'error');
            return;
        }
        
        if (!gameState) {
            showNotification('沒有遊戲數據可匯出', 'error');
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        // Player summary sheet
        const summaryData = [
            ['玩家統計表'],
            ['玩家名稱', '總輸贏', '當莊輪數'],
            ...gameState.players.map(player => [
                player.name,
                player.totalWinLoss,
                player.bankerRounds
            ])
        ];
        
        const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summaryWs, '玩家統計');
        
        // Detailed records sheet
        const detailHeaders = ['輪數', '莊家', ...gameState.players.map(p => p.name)];
        const detailData = [
            ['詳細記錄表'],
            detailHeaders,
            ...gameState.rounds.map(round => {
                const row = [round.roundNumber, round.bankerName];
                gameState.players.forEach(player => {
                    if (player.id === round.bankerId) {
                        const bankerTotal = round.records.reduce((sum, record) => sum - record.amount, 0);
                        row.push(`莊家 (${bankerTotal})`);
                    } else {
                        const record = round.records.find(r => r.playerId === player.id);
                        row.push(record ? record.amount : 0);
                    }
                });
                return row;
            }),
            ['', '總計', ...gameState.players.map(p => p.totalWinLoss)]
        ];
        
        const detailWs = XLSX.utils.aoa_to_sheet(detailData);
        XLSX.utils.book_append_sheet(wb, detailWs, '詳細記錄');
        
        const timestamp = new Date().toLocaleString('zh-TW').replace(/[/:]/g, '-');
        const gameName = gameManager.currentGameId ? gameManager.games[gameManager.currentGameId].name : '遊戲記錄';
        const filename = `${gameName}_${timestamp}.xlsx`;
        
        XLSX.writeFile(wb, filename);
        showNotification('Excel檔案匯出成功', 'success');
    } catch (error) {
        console.error('Export error:', error);
        showNotification('匯出失敗，請重試', 'error');
    }
};

window.saveGame = function() {
    try {
        if (!gameState || !gameManager.currentGameId) {
            showNotification('沒有遊戲數據可保存', 'error');
            return;
        }
        
        const currentGame = gameManager.games[gameManager.currentGameId];
        const gameData = {
            ...currentGame,
            exportedAt: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(gameData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toLocaleString('zh-TW').replace(/[/:]/g, '-');
        const filename = `${currentGame.name}_${timestamp}.json`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('遊戲存檔已下載', 'success');
    } catch (error) {
        console.error('Save error:', error);
        showNotification('保存失敗，請重試', 'error');
    }
};

// Toast Notifications
function showNotification(message, type = 'success', duration = 3000) {
    const toast = document.getElementById('successToast');
    const messageEl = document.getElementById('toastMessage');
    
    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden', 'fade-out');
        
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 250);
        }, duration);
    }
}

// Network Status Detection
function detectOnlineStatus() {
    function updateOnlineStatus() {
        if (navigator.onLine) {
            googleDriveManager.hideOfflineMode();
            if (googleDriveManager.isSignedIn && autoSync && !autoSync.isRunning) {
                autoSync.start();
            }
        } else {
            googleDriveManager.showOfflineMode();
            if (autoSync && autoSync.isRunning) {
                autoSync.stop();
            }
        }
        updateSyncStatus();
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check initial status
    updateOnlineStatus();
}

// Event Listeners
function initializeEventListeners() {
    console.log('Initializing event listeners...');
    
    // Enter key handlers
    const inputs = [
        { id: 'playerNameInput', action: () => window.addPlayer() },
        { id: 'amountInput', action: () => window.confirmAmount() },
        { id: 'editAmountInput', action: () => window.confirmEditRecord() },
        { id: 'newPlayerNameInput', action: () => window.confirmAddPlayer() },
        { id: 'gameNameInput', action: () => window.confirmCreateGame() },
        { id: 'creatorNameInput', action: () => window.confirmCreateGame() }
    ];
    
    inputs.forEach(({ id, action }) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    action();
                }
            });
            console.log('Added enter key listener to:', id);
        }
    });
    
    // Modal background click to close
    const modals = [
        { id: 'amountModal', closeFunc: () => window.closeAmountModal() },
        { id: 'editRecordModal', closeFunc: () => window.closeEditRecordModal() },
        { id: 'addPlayerModal', closeFunc: () => window.closeAddPlayerModal() },
        { id: 'createGameModal', closeFunc: () => window.closeCreateGameModal() },
        { id: 'conflictModal', closeFunc: closeConflictModal }
    ];
    
    modals.forEach(({ id, closeFunc }) => {
        const modal = document.getElementById(id);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    closeFunc();
                }
            });
            console.log('Added click listener to modal:', id);
        }
    });
    
    console.log('Event listeners initialized');
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 DOM loaded, initializing app...');
    console.log('📱 Device detection:', isMobileDevice() ? 'Mobile' : 'Desktop');
    console.log('📱 Screen width:', window.innerWidth);
    console.log('📱 User agent:', navigator.userAgent.substring(0, 50) + '...');
    
    initializeEventListeners();
    detectOnlineStatus();
    
    // Show welcome screen first
    showWelcome();
    
    // Initialize Google Drive after a short delay to ensure DOM is ready
    setTimeout(async () => {
        try {
            console.log('⏰ Starting delayed Google Drive initialization...');
            await googleDriveManager.initialize();
        } catch (error) {
            console.log('❌ Google Drive initialization failed:', error);
        }
    }, 2000); // Increased to 2 seconds
    
    // Auto-sync timer
    setInterval(() => {
        updateSyncStatus();
        updateGameLockStatus();
        updateCloudSyncStatus();
        updateGoogleDriveSettings();
    }, 60000); // Update every minute
});

console.log('📱 Enhanced script loaded with Mobile-Optimized Google Identity Services (GIS) integration');
