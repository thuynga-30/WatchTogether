import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import axios from 'axios';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Autoplay } from 'swiper/modules';
import { Star, Play, Clock } from "lucide-react";
import 'swiper/css';
import 'swiper/css/navigation';
import {getImageUrl} from "@/services/api.ts";

const RecommendedSlider = ({ userId }) => {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        if (!userId) return;
        const fetchMovies = async () => {
            try {
                setLoading(true);
                const res = await axios.get(`http://localhost:8080/api/movies/ai/recommend?userId=${userId}`);
                setMovies(res.data);
            } catch (error) {
                console.error("Lỗi lấy phim gợi ý:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMovies();
    }, [userId]);

    if (loading) return <div className="animate-pulse text-gray-400">Đang chọn lọc phim cho bạn...</div>;
    if (movies.length === 0) return null;

    return (
        <div className="w-full group/slider">
            <Swiper
                modules={[Navigation, Autoplay]}
                navigation
                spaceBetween={20}
                slidesPerView={2}
                autoplay={{ delay: 5000 }}
                breakpoints={{
                    640: { slidesPerView: 3 },
                    1024: { slidesPerView: 5 },
                }}
                className="pb-10"
            >
                {movies.map((movie) => (
                    <SwiperSlide key={movie.id}>
                        <div
                            onClick={() => navigate(`/movie/${movie.id}`)}
                            className="relative group cursor-pointer bg-card rounded-xl overflow-hidden border border-border/50 hover:border-primary/50 transition-all duration-500 hover:shadow-[0_0_20px_rgba(234,88,12,0.3)]"
                        >
                            {/* Poster Phim - Lấy từ trường 'poster' trong DB */}
                            <div className="aspect-[2/3] overflow-hidden relative">
                                <img
                                    // Dùng getImageUrl để tạo link ảnh hoàn chỉnh. Nếu không có poster thì dùng ảnh mặc định.
                                    src={movie.poster ? getImageUrl(movie.poster) : "https://via.placeholder.com/300x450"}
                                    alt={movie.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                />
                                {/* Lớp phủ khi hover */}
                                <div
                                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                                    <div
                                        className="bg-primary p-3 rounded-full translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                        <Play className="fill-white text-white h-6 w-6"/>
                                    </div>
                                </div>

                                {/* Badge Thể loại hoặc Rating góc ảnh */}
                                <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    {movie.rating > 0 && (
                                        <div
                                            className="bg-black/70 backdrop-blur-md px-2 py-1 rounded-md flex items-center gap-1 border border-yellow-500/50">
                                            <Star className="h-3 w-3 fill-yellow-500 text-yellow-500"/>
                                            <span className="text-yellow-500 text-xs font-bold">{movie.rating}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Thông tin phim bên dưới ảnh */}
                            <div className="p-3 space-y-1">
                                <h3 className="text-white font-medium truncate group-hover:text-primary transition-colors">
                                    {movie.title}
                                </h3>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {movie.duration}p
                                    </span>
                                    <span>{movie.releaseYear}</span>
                                </div>
                                {movie.category && (
                                    <div className="text-[10px] uppercase tracking-wider text-primary/80 font-semibold pt-1">
                                        {movie.category.name}
                                    </div>
                                )}
                            </div>
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>
        </div>
    );
};

export default RecommendedSlider;