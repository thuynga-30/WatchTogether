import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from model import movies, ratings, tfidf_matrix, indices
from utils import normalize_text


def find_movie_index(title: str):
   
    normalized = normalize_text(title)


    if normalized in indices:
        return indices[normalized], normalized

    # Fallback: tìm key nào trong indices chứa chuỗi này 
    
    for key in indices.index:
        if key == normalized:          
            continue
        if normalized in key or key in normalized:
            return indices[key], key

    return None, None

# BUILD USER PROFILE

def build_user_profile(user_data):

    user_vector = np.zeros(tfidf_matrix.shape[1])

    total_weight = 0

    for _, row in user_data.iterrows():

        title = normalize_text(row['title'])

        rating = row['rating']

        if title in indices:

            idx = indices[title]

            weight = rating / 5

            user_vector += tfidf_matrix[idx].toarray()[0] * weight

            total_weight += weight

    if total_weight > 0:

        user_vector /= total_weight

    return user_vector


# USER RECOMMEND

def recommend_movies(user_id, top_n=10):

    user_data = ratings[ratings['user_id'] == user_id]

    if user_data.empty:
        return []

    user_vector = build_user_profile(user_data)

    similarity_scores = cosine_similarity(
        [user_vector],
        tfidf_matrix
    )[0]

    watched = set(
        user_data['title']
        .apply(normalize_text)
    )

    results = []

    for i, sim in enumerate(similarity_scores):

        title = movies.iloc[i]['title']

        normalized_title = normalize_text(title)

        if normalized_title in watched:
            continue

        final_score = 0.7 * sim

        if final_score > 0.1:

            poster = ""

            if 'poster' in movies.columns:
                poster = movies.iloc[i].get('poster', '')

            elif 'poster_url' in movies.columns:
                poster = movies.iloc[i].get('poster_url', '')

            category = "Unknown"

            if 'category' in movies.columns:
                category = movies.iloc[i].get('category', 'Unknown')

            elif 'genre' in movies.columns:
                category = movies.iloc[i].get('genre', 'Unknown')

            elif 'genres' in movies.columns:
                category = movies.iloc[i].get('genres', 'Unknown')

            results.append({

                "id": int(movies.iloc[i].get('id', 0)),

                "title": title,

                "score": round(float(final_score), 3),

                "posterUrl": poster,

                "genre": category

            })

    results = sorted(
        results,
        key=lambda x: x['score'],
        reverse=True
    )

    return results[:top_n]



# BUILD GROUP PROFILE

def build_group_profile(user_ids):

    group_vector = np.zeros(tfidf_matrix.shape[1])

    count = 0

    for user_id in user_ids:

        user_data = ratings[
            ratings['user_id'] == user_id
        ]

        if user_data.empty:
            continue

        user_vector = build_user_profile(user_data)

        group_vector += user_vector

        count += 1

    if count > 0:
        group_vector /= count

    return group_vector


# REALTIME ROOM SIGNALS

room_signals = {}


def update_room_signal(room_id, movie_title, action):

    if room_id not in room_signals:
        room_signals[room_id] = {}

    normalized_title = normalize_text(movie_title)

    if normalized_title not in room_signals[room_id]:

        room_signals[room_id][normalized_title] = {
            "play": 0,
            "pause": 0,
            "complete": 0
        }

    room_signals[room_id][normalized_title][action] += 1


def get_realtime_score(room_id, title):

    if room_id not in room_signals:
        return 0

    normalized_title = normalize_text(title)

    if normalized_title not in room_signals[room_id]:
        return 0

    data = room_signals[room_id][normalized_title]

    score = (
        data["play"] * 0.2
        - data["pause"] * 0.3
        + data["complete"] * 0.5
    )

    return max(0, min(score, 1))


# POPULARITY SCORE

def get_popularity(title):

    normalized_title = normalize_text(title)

    temp = ratings.copy()

    temp['normalized_title'] = temp['title'].apply(
        normalize_text
    )

    movie_ratings = temp[
        temp['normalized_title'] == normalized_title
    ]

    if movie_ratings.empty:
        return 0

    avg = movie_ratings['rating'].mean()

    return avg / 5


# USER SCORE

def get_user_score(group_vector, movie_index):

    if np.linalg.norm(group_vector) == 0:
        return 0

    movie_vector = tfidf_matrix[movie_index].toarray()[0]

    sim = cosine_similarity(
        [group_vector],
        [movie_vector]
    )[0][0]

    return sim


# ROOM REALTIME RECOMMEND

def recommend_for_room_realtime(
    room_id,
    current_movie,
    user_ids=None,
    top_n=10
):
    print("INPUT:", current_movie)

    normalized_movie, resolved_key = None, None

    idx_result, resolved_key = find_movie_index(current_movie)

    if idx_result is None:
        print("KHÔNG TÌM THẤY PHIM TRONG INDICES:", current_movie)
        return []

    normalized_movie = resolved_key
    print("RESOLVED KEY:", normalized_movie)

    if not room_id:
        return []

    current_idx = idx_result

    content_scores = cosine_similarity(
        tfidf_matrix[current_idx].reshape(1, -1),
        tfidf_matrix
    )[0]

    # GROUP PROFILE 
    group_vector = np.zeros(tfidf_matrix.shape[1])
    count = 0

    if user_ids:
        for uid in user_ids:
            user_data = ratings[ratings['user_id'] == uid]
            if not user_data.empty:
                group_vector += build_user_profile(user_data)
                count += 1

    if count > 0:
        group_vector /= count

    results = []

    for i, content_score in enumerate(content_scores):
        title = movies.iloc[i]['title']
        normalized_title = normalize_text(title)

        if normalized_title == normalized_movie:
            continue

        # USER SCORE 
        user_score = get_user_score(group_vector, i) if count > 0 else 0

        #POPULARITY
        popularity = get_popularity(title)

        #REALTIME 
        realtime = get_realtime_score(room_id, title)

        # FINAL SCORE
        final = (
            0.4 * content_score +
            0.3 * user_score +
            0.2 * popularity +
            0.1 * realtime
        )

        if final > 0.15:
            poster = (
                movies.iloc[i].get('poster', '')
                or movies.iloc[i].get('poster_url', '')
            )
            category = (
                movies.iloc[i].get('category')
                or movies.iloc[i].get('genre')
                or movies.iloc[i].get('genres')
                or 'Unknown'
            )

            results.append({
                "id":         int(movies.iloc[i].get('id', 0)),
                "title":      title,
                "score":      round(float(final), 3),
                "posterUrl":  poster,
                "genre":      category,
                "content":    round(float(content_score), 3),
                "user":       round(float(user_score), 3),
                "popularity": round(float(popularity), 3),
                "realtime":   round(float(realtime), 3),
            })

    results.sort(key=lambda x: x['score'], reverse=True)
    return results[:top_n]
