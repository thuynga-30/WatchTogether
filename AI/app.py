from flask import Flask, jsonify, request
from service import recommend_movies, recommend_for_room_realtime
from urllib.parse import unquote

app = Flask(__name__)

@app.route('/recommend/<int:user_id>', methods=['GET'])
def recommend(user_id):
    try:
        data = recommend_movies(user_id)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


    
@app.route('/recommend/room/realtime', methods=['GET'])
def recommend_room_realtime_api():
    try:
        room_id = request.args.get('roomId')
        movie   = unquote(request.args.get('movie', ''))  
        users   = request.args.get('users')

        user_ids = list(map(int, users.split(','))) if users else None

        recs = recommend_for_room_realtime(room_id, movie, user_ids)
        return jsonify(recs)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

