import React, { useState, useEffect } from 'react';
import communityPostService from '../services/communityPostService';
import { isAuthenticated } from '../services/authService';
import { useNavigate } from 'react-router-dom';

const UploadTestPage = () => {
    const [content, setContent] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [feedback, setFeedback] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        if (!isAuthenticated()) {
            navigate('/login');
            return;
        }
    }, [navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Package the data in an object
            const payload = { content, imageUrl };

            const response = await communityPostService.createPost(payload);
            console.log('Server response:', response.data);
        } catch (error) {
            console.error('Upload error:', error);
            // Display a more detailed message if available
        if (error.response && error.response.data) {
            setFeedback(`Error: ${error.response.data.message || error.message}`);
        } else {
            setFeedback(`Error: ${error.message}`);
        }
        }
    };

    return (
        <div style={{ padding: '20px' }}>
        <h2>Upload Test Page</h2>
        <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '15px' }}>
            <label>
                Content:<br />
                <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows="5"
                cols="40"
                placeholder="Enter your content here..."
                style={{ marginTop: '5px' }}
                />
            </label>
            </div>
            <div style={{ marginBottom: '15px' }}>
            <label>
                Image URL:<br />
                <input
                type="text"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="http://example.com/image.jpg"
                style={{ marginTop: '5px', width: '400px' }}
                />
            </label>
            </div>
            <button type="submit">Upload</button>
        </form>
        {feedback && <div style={{ marginTop: '15px' }}>{feedback}</div>}
        </div>
    );
};

export default UploadTestPage;