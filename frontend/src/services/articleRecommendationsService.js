import axios from 'axios';

class ArticleRecommendationsService {
    constructor() {
        this.axiosInstance = axios.create({
            baseURL: 'http://localhost:8000/api/v1',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
    }

    async getArticleRecommendations() {
        try {
            const response = await this.axiosInstance.get('/article_recommendations/');
            const recommendedArticles = response.data.data.articles || [];
            console.log('Recommended Articles:', recommendedArticles);
            return recommendedArticles;
        } catch (error) {
            console.error('Error fetching article recommendations:', error);
            return [];
        }
    }
}

export default new ArticleRecommendationsService();