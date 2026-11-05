"""
validate.py - CLI tool for cross-validating TypeScript indicators against Python
"""

import sys
import json
from python.indicator_engine import compute_all_indicators

def main():
    try:
        input_data = sys.stdin.read()
        if not input_data:
            print(json.dumps({'error': 'No input data provided'}))
            sys.exit(1)
        payload = json.loads(input_data)
        candles = payload.get('candles', [])
        if not candles:
            print(json.dumps({'error': 'Empty candles list'}))
            sys.exit(1)
            
        results = compute_all_indicators(candles)
        print(json.dumps(results))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

if __name__ == '__main__':
    main()
