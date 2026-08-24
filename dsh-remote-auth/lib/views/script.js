// 获取 DOM 元素
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoader = submitBtn.querySelector('.btn-loader');
const errorMessage = document.getElementById('errorMessage');
const togglePasswordBtn = document.querySelector('.toggle-password');

// 密码显示/隐藏切换
let passwordVisible = false;
togglePasswordBtn.addEventListener('click', () => {
    passwordVisible = !passwordVisible;
    passwordInput.type = passwordVisible ? 'text' : 'password';

    // 更新图标
    const eyeIcon = togglePasswordBtn.querySelector('.eye-icon');
    if (passwordVisible) {
        eyeIcon.innerHTML = `
            <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>
        `;
    } else {
        eyeIcon.innerHTML = `
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
        `;
    }
});

// 显示错误信息
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    errorMessage.style.animation = 'shake 0.5s';

    setTimeout(() => {
        errorMessage.style.animation = '';
    }, 500);
}

// 隐藏错误信息
function hideError() {
    errorMessage.style.display = 'none';
}

// 设置加载状态
function setLoading(loading) {
    if (loading) {
        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'block';
    } else {
        submitBtn.disabled = false;
        btnText.style.display = 'block';
        btnLoader.style.display = 'none';
    }
}

// 表单提交处理
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    // 前端验证
    if (!username || !password) {
        showError('请填写完整的登录信息');
        return;
    }

    if (username.length < 3) {
        showError('用户名长度至少为 3 个字符');
        return;
    }

    if (password.length < 6) {
        showError('密码长度至少为 6 个字符');
        return;
    }

    // 设置加载状态
    setLoading(true);

    try {
        // 发送登录请求
        const response = await fetch('/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            // 登录成功，获取重定向 URL
            const data = await response.json();
            const redirectUrl = data.redirect || new URLSearchParams(window.location.search).get('next') || '/';

            // 添加成功动画
            submitBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
                <span>登录成功</span>
            `;

            // 延迟跳转，展示成功状态
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 800);
        } else {
            // 登录失败
            const data = await response.json().catch(() => ({}));
            const errorMsg = data.message || '用户名或密码错误';
            showError(errorMsg);
            setLoading(false);

            // 抖动效果
            loginForm.style.animation = 'shake 0.5s';
            setTimeout(() => {
                loginForm.style.animation = '';
            }, 500);
        }
    } catch (error) {
        console.error('登录请求失败:', error);
        showError('网络连接失败，请稍后重试');
        setLoading(false);
    }
});

// 输入框聚焦时清除错误
usernameInput.addEventListener('focus', hideError);
passwordInput.addEventListener('focus', hideError);

// 添加抖动动画
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
        20%, 40%, 60%, 80% { transform: translateX(10px); }
    }
`;
document.head.appendChild(style);

// 自动聚焦到用户名输入框
usernameInput.focus();
