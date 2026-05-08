package com.mv.movie.dto.response;

import java.util.List;

public class AIRecommendResponse {
    private int id;
    private String title;
    private double score;
    private String posterUrl;

    public String getPosterUrl() {
        return posterUrl;
    }

    public void setPosterUrl(String posterUrl) {
        this.posterUrl = posterUrl;
    }

    public String getGenre() {
        return genre;
    }

    public void setGenre(String genre) {
        this.genre = genre;
    }

    private String genre;
    private double content;

    private double user;

    private double popularity;

    private double realtime;

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public double getScore() { return score; }
    public void setScore(double score) { this.score = score; }
    public double getContent() {
        return content;
    }

    public void setContent(double content) {
        this.content = content;
    }

    public double getUser() {
        return user;
    }

    public void setUser(double user) {
        this.user = user;
    }

    public double getPopularity() {
        return popularity;
    }

    public void setPopularity(double popularity) {
        this.popularity = popularity;
    }

    public double getRealtime() {
        return realtime;
    }

    public void setRealtime(double realtime) {
        this.realtime = realtime;
    }
}
