import axios from "axios";

class CommunityPostService {
    constructor() {
        this.axiosInstance = axios.create({
            baseURL: 'http://localhost:8000/api/v1',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
    }

    async createPost(postData) {
        try {
            const response = await this.axiosInstance.post('/posts/create', postData);
            return response.data;
        } catch (error) {
            console.error('Error creating community post:', error);
            throw error;
        }
    }
}

export default new CommunityPostService();
