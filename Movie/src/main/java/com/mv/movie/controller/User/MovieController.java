package com.mv.movie.controller.User;

import com.mv.movie.dto.response.AIRecommendResponse;
import com.mv.movie.entity.Movies;
import com.mv.movie.repository.MovieRepository;
import com.mv.movie.repository.RatingRepository; // Import cái này
import com.mv.movie.service.AIRecommendService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/movies")
public class MovieController {

    @Autowired
    private MovieRepository movieRepository;

    @Autowired
    private RatingRepository ratingRepository;
    @Autowired
    private AIRecommendService aiRecommendService;


    // 1. API Lấy danh sách phim (Có phân trang)
    @GetMapping
    public ResponseEntity<?> getAllMovies(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search
    ) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("id").descending());
        Page<Movies> moviePage;
        // LOGIC TÌM KIẾM
        if (search != null && !search.isEmpty()) {
            // Nếu có từ khóa -> Tìm kiếm
            moviePage = movieRepository.findByTitleContainingIgnoreCase(search, pageable);
        } else {
            // Nếu không -> Lấy tất cả
            moviePage = movieRepository.findAll(pageable);
        }

        // TÍNH ĐIỂM RATING CHO KẾT QUẢ TÌM ĐƯỢC
        for (Movies movie : moviePage.getContent()) {
            calculateAndSetRating(movie); // Hàm tính điểm bạn đã viết ở bước trước
        }
        return ResponseEntity.ok(moviePage);
    }

    // 2. API Lấy chi tiết 1 phim
    @GetMapping("/{id}")
    public ResponseEntity<?> getMovieById(@PathVariable Long id) {
        Movies movie = movieRepository.findById(Math.toIntExact(id))
                .orElseThrow(() -> new RuntimeException("Phim không tồn tại"));

        calculateAndSetRating(movie);

        return ResponseEntity.ok(movie);
    }

    // --- HÀM PHỤ TRỢ ĐỂ TÍNH VÀ LÀM TRÒN ĐIỂM ---
    private void calculateAndSetRating(Movies movie) {
        Double avg = ratingRepository.getAverageRating(Long.valueOf(movie.getId()));

        if (avg != null) {
            // Làm tròn 1 chữ số thập phân (VD: 4.6666 -> 4.7)
            double rounded = Math.round(avg * 10.0) / 10.0;
            movie.setRating(rounded);
        } else {
            // Nếu chưa ai đánh giá thì cho 0 điểm (hoặc N/A tùy logic)
            movie.setRating(0.0);
        }
    }
    @GetMapping("/ai/recommend")
    public ResponseEntity<?> getRecommend(@RequestParam int userId) {

        try {
            AIRecommendResponse[] list = aiRecommendService.getAIRecommend(userId);

            List<Movies> result = new ArrayList<>();

            for (AIRecommendResponse r : list) {

                // 🔥 tìm phim trong DB theo title
                Movies movie = movieRepository
                        .findFirstByTitleContainingIgnoreCase(r.getTitle().trim());

                if (movie != null) {
                    calculateAndSetRating(movie); // thêm rating
                    result.add(movie);
                }
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Lỗi gọi AI: " + e.getMessage());
        }
    }

}