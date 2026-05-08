package com.mv.movie.service;

import com.mv.movie.dto.response.AIRecommendResponse;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class AIRecommendService {

    private final String API_URL =
            "http://127.0.0.1:5000/recommend/";

    private final RestTemplate restTemplate =
            new RestTemplate();

    // =========================
    // USER RECOMMEND
    // =========================

    public AIRecommendResponse[] getAIRecommend(int userID) {

        return restTemplate.getForObject(
                API_URL + userID,
                AIRecommendResponse[].class
        );
    }

    // =========================
    // ROOM RECOMMEND
    // =========================

    public AIRecommendResponse[] getGroupRecommend(
            String roomId,
            String currentMovieTitle,
            List<Long> userIds
    ) {

        String usersParam = "";

        if (userIds != null && !userIds.isEmpty()) {

            usersParam = userIds.stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(","));
        }

        String url = UriComponentsBuilder
                .fromHttpUrl(API_URL + "room/realtime")
                .queryParam("roomId", roomId)
                .queryParam("movie", currentMovieTitle)
                .queryParam("users", usersParam)
                .toUriString();


        return restTemplate.getForObject(
                url,
                AIRecommendResponse[].class
        );
    }
}