import pandas as pd
from sqlalchemy import create_engine
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from utils import normalize_text

engine = create_engine("mysql+pymysql://root:1234@localhost/watchtogether")

# Load data
movies = pd.read_sql("SELECT * FROM movies", engine)

ratings = pd.read_sql("""
SELECT u.id as user_id, m.title, r.rating
FROM ratings r
JOIN users u ON r.user_id = u.id
JOIN movies m ON r.movie_id = m.id
""", engine)

# TF-IDF
tfidf = TfidfVectorizer(stop_words='english')

movies['description'] = movies['description'].fillna("")

tfidf_matrix = tfidf.fit_transform(movies['description'])

movies['normalized_title'] = movies['title'].apply(normalize_text)

indices = pd.Series(
    movies.index,
    index=movies['normalized_title']
).drop_duplicates()

