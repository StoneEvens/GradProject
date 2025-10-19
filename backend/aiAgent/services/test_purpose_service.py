import sys
import os
from purpose_service import PurposeService

def test_purpose_matching():
    # Initialize the service
    service = PurposeService()
    
    # Test cases - each is a tuple of (user_input, expected_top_function)
    test_cases = [
        ("我應該怎麼在貼文中標註寵物呢？", "系統使用教學"),
        ("替我記錄狗狗的健康狀況", "系統代理操作"),
        ("我的吉娃娃應該吃甚麼飼料呢", "飼料查詢"),
        ("我的吉娃娃體重多少呢？", "寵物情況查詢"),
        ("幫我找有發吉娃娃相關貼文的帳號", "進階帳號查詢"),
    ]
    
    print("\nRunning purpose matching tests...")
    print("-" * 50)
    
    for user_input, expected_top_function in test_cases:
        print(f"\nTest input: {user_input}")
        print(f"Expected top function: {expected_top_function}")
        
        # Get matches with similarity scores
        matches = service.find_similar_purposes(user_input, top_k=2)
        
        # Print results
        print("\nMatches found:")
        for match in matches:
            print(f"- {match['function']} (similarity: {match['similarity']:.3f})")
            print(f"  Description: {match['description']}")
        
        # Check if top match matches expected
        top_match = matches[0]['function']
        result = "✓ PASS" if top_match == expected_top_function else "✗ FAIL"
        print(f"\nResult: {result}")
        if top_match != expected_top_function:
            print(f"Expected: {expected_top_function}")
            print(f"Got: {top_match}")
        
        print("-" * 50)

def interactive_test():
    service = PurposeService()
    
    print("\nInteractive testing mode")
    print("Enter your input text (or 'quit' to exit)")
    print("-" * 50)
    
    while True:
        try:
            user_input = input("\nEnter text: ").strip()
            if user_input.lower() == 'quit':
                break
                
            matches = service.find_similar_purposes(user_input, top_k=3)
            
            print("\nTop matches:")
            for match in matches:
                print(f"\n- Function: {match['function']}")
                print(f"  Description: {match['description']}")
                print(f"  Similarity: {match['similarity']:.3f}")
                
        except Exception as e:
            print(f"Error: {str(e)}")
    
    print("\nExiting interactive mode")

if __name__ == "__main__":
    # Run predefined tests
    test_purpose_matching()
    
    # Run interactive mode
    print("\nStarting interactive mode...")
    interactive_test()