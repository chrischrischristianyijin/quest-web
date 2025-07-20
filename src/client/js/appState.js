// 统一的应用状态管理
class AppState {
    constructor() {
        this.user = null;
        this.isAuthenticated = false;
        this.isLoading = false;
        this.listeners = [];
        this.init();
    }

    // 初始化状态
    async init() {
        // 从localStorage恢复用户状态
        const userEmail = localStorage.getItem('userEmail');
        if (userEmail) {
            await this.setUser({ email: userEmail });
        }
    }

    // 设置用户状态
    async setUser(user) {
        this.user = user;
        this.isAuthenticated = !!user;
        
        if (user && user.email) {
            localStorage.setItem('userEmail', user.email);
        } else {
            localStorage.removeItem('userEmail');
        }
        
        this.notifyListeners();
    }

    // 清除用户状态
    clearUser() {
        this.user = null;
        this.isAuthenticated = false;
        localStorage.removeItem('userEmail');
        this.notifyListeners();
    }

    // 设置加载状态
    setLoading(loading) {
        this.isLoading = loading;
        this.notifyListeners();
    }

    // 订阅状态变化
    subscribe(listener) {
        this.listeners.push(listener);
        // 立即调用一次，传递当前状态
        listener(this);
        
        // 返回取消订阅的函数
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    // 通知所有监听器
    notifyListeners() {
        this.listeners.forEach(listener => {
            try {
                listener(this);
            } catch (error) {
                console.error('Error in state listener:', error);
            }
        });
    }

    // 获取用户信息
    async getUserInfo() {
        if (!this.user || !this.user.email) {
            return null;
        }

        try {
            const response = await fetch(`/api/v1/users?email=${encodeURIComponent(this.user.email)}`);
            if (response.ok) {
                const data = await response.json();
                return data.user;
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
        
        return null;
    }

    // 更新用户昵称
    async updateNickname(nickname) {
        if (!this.user || !this.user.email) {
            return false;
        }

        try {
            const response = await fetch('/api/v1/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ nickname })
            });

            if (response.ok) {
                const data = await response.json();
                await this.setUser({ ...this.user, nickname: data.nickname });
                return true;
            }
        } catch (error) {
            console.error('Error updating nickname:', error);
        }

        return false;
    }
}

// 创建全局状态实例
const appState = new AppState();

// 导出状态实例和类
export { appState, AppState }; 