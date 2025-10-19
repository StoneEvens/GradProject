import { ref } from 'vue';
import axios from 'axios';

/**
 * AI Assistant Service
 * Connects frontend to the AI Controller backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const useAIAssistant = () => {
  const isProcessing = ref(false);
  const error = ref(null);

  /**
   * Send a request to the AI assistant
   * @param {string} request - Natural language request
   * @returns {Promise<Object>} Response from AI
   */
  const sendRequest = async (request) => {
    isProcessing.value = true;
    error.value = null;

    try {
      const response = await axios.post(`${API_BASE_URL}/assist/`, {
        request: request
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data;
    } catch (err) {
      error.value = err.response?.data?.error || err.message;
      throw err;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * Check if AI assistant is available
   * @returns {Promise<Object>} Status information
   */
  const checkStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/status/`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      return response.data;
    } catch (err) {
      error.value = err.response?.data?.error || err.message;
      throw err;
    }
  };

  return {
    isProcessing,
    error,
    sendRequest,
    checkStatus
  };
};

// Example Usage in a Vue Component:
/*
import { useAIAssistant } from '@/services/aiAssistant';

export default {
  setup() {
    const { isProcessing, error, sendRequest } = useAIAssistant();

    const handleAIRequest = async () => {
      try {
        const result = await sendRequest("Add a new pet named Max");
        console.log('AI completed task:', result);
      } catch (err) {
        console.error('AI failed:', err);
      }
    };

    return {
      isProcessing,
      error,
      handleAIRequest
    };
  }
};
*/