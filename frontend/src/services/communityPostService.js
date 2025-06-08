import axios from "axios";
import { getAccessToken } from "./authService";
import { authAxios } from "./authService";

class CommunityPostService {
    constructor() {
        this.axiosInstance = axios.create({
            baseURL: 'http://localhost:8000/api/v1',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        this.axiosInstance.interceptors.request.use((config) => {
            const token = getAccessToken();
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });
    }

    async createPost(postData) {
        try {
            const response = await this.axiosInstance.post('/social/posts/create/', postData);
            return response.data;
        } catch (error) {
            console.error('Error creating community post:', error);
            throw error;
        }
    }
}

export default new CommunityPostService();
