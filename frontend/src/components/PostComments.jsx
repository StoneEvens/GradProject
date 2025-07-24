import React, { useState, useRef } from 'react';
import { checkUserAccount } from '../services/userService';

const PostComments = ({user, postID, isPreview}) => {
    const fetchComments = async (postID, number) => {
        try {
            const response = await fetch(`/post/${postID}/comments?limit=${number}`);
            if (!response.ok) {
                throw new Error('Failed to fetch comments');
            }
            const data = await response.json();
            return data.comments || [];
        } catch (error) {
            console.error('Error fetching comments:', error);
            return [];
        }
    };

    const [comments, setComments] = useState([]);

    React.useEffect(() => {
        const loadComments = async () => {
            const fetchedComments = await fetchComments(postID, 10); // Fetch 10 comments by default
            setComments(fetchedComments);
        };

        loadComments();
    }, [postID]);


    return (
        <div className={`comments-container ${comments.length === 0 ? 'empty' : ''}`}>
            {comments.length === 0 ? (
                <p>No comments available.</p>
            ) : (
                comments.map((comment, index) => (
                    <div key={index} className="comment-block">
                        <p className="comment-text">{comment.text}</p>
                        <button className="reply-button">Reply</button>
                    </div>
                ))
            )}
            <div className="new-comment">
                <textarea placeholder="Write a comment..." className="comment-input"></textarea>
                <button className="submit-comment-button">Submit</button>
            </div>
        </div>
    );
};

export default PostComments;