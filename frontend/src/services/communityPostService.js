import axios from "axios";
import { getAccessToken } from "./authService";

class CommunityPostService {
    constructor() {
        this.axiosInstance = axios.create({
            baseURL: 'http://localhost:8000/api/v1',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${getAccessToken()}`
            }
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
