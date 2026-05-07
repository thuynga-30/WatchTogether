import { useState, useEffect, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
// Thêm icon Sparkles (Lấp lánh) cho khu vực AI
import { Play, Users, Film, TrendingUp, Star, Loader2, Search, X, Frown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/Navbar";
import MovieCard from "@/components/MovieCard";
import heroBanner from "@/assets/hero-banner.jpg";
import { api, getImageUrl } from "@/services/api";

import SockJS from 'sockjs-client';
import Stomp from 'stompjs';
import { useToast } from "@/hooks/use-toast";
import RecommendedSlider from '@/components/RecommendedSlider';

interface Movie {
  id: number;
  title: string;
  poster: string;
  rating?: number;
  releaseYear: number;
  duration: number;
  category?: { id: number; name: string };
}

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchParams] = useSearchParams();
  const searchKeyword = searchParams.get("search");

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  // STATE MỚI: Lưu ID người dùng đang đăng nhập
  const [userId, setUserId] = useState<number | null>(null);

  const searchKeywordRef = useRef(searchKeyword);

  useEffect(() => {
    searchKeywordRef.current = searchKeyword;
  }, [searchKeyword]);

  // LOGIC LẤY USER ID TỪ LOCAL STORAGE (Khi trang vừa load)
  useEffect(() => {
    // Lưu ý: Đổi chữ 'user' thành key mà project của bạn đang dùng để lưu thông tin đăng nhập
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.id) {
          setUserId(parsedUser.id);
        }
      } catch (error) {
        console.error("Lỗi khi đọc thông tin user:", error);
      }
    }
  }, []);

  // LOGIC SOCKET
  useEffect(() => {
    const socket = new SockJS('http://localhost:8080/ws');
    const client = Stomp.over(socket);

    client.debug = () => {};

    client.connect({}, () => {
      client.subscribe('/topic/movies', (message) => {
        const newMovie: Movie = JSON.parse(message.body);

        toast({
          title: "🎬 Phim mới vừa lên sóng!",
          description: `Phim "${newMovie.title}" (${newMovie.releaseYear}) vừa được thêm.`,
          duration: 5000,
          action: <Button variant="outline" size="sm" onClick={() => {
            document.getElementById('movie-section')?.scrollIntoView({ behavior: 'smooth' });
          }}>Xem</Button>
        });

        if (!searchKeywordRef.current) {
          setMovies(prevMovies => [newMovie, ...prevMovies]);
        }
      });
    });

    return () => {
      if (client && client.connected) {
        client.disconnect(() => {});
      }
    };
  }, [toast]);

  // LOGIC GỌI API PHIM
  useEffect(() => {
    const fetchMovies = async () => {
      try {
        setLoading(true);
        let endpoint = "";

        if (searchKeyword) {
          endpoint = `/api/movies?search=${encodeURIComponent(searchKeyword)}`;
        } else {
          endpoint = "/api/movies?page=0&size=12&sort=id,desc";
        }

        const response = await api.get(endpoint);
        setMovies(response.data.content || []);
      } catch (error) {
        console.error("Lỗi tải phim:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMovies();
  }, [searchKeyword]);

  const clearSearch = () => {
    navigate("/");
  };

  return (
      <div className="min-h-screen bg-background pb-20">
        <Navbar />

        {!searchKeyword && (
            <section className="relative h-screen flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0">
                <img src={heroBanner} alt="Rạp chiếu phim" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-hero" />
                <div className="absolute inset-0 bg-background/40" />
              </div>

              <div className="relative z-10 container mx-auto px-4 text-center space-y-8">
                <h1 className="text-5xl md:text-7xl font-bold text-foreground drop-shadow-lg animate-in fade-in slide-in-from-bottom-4 duration-1000">
                  Xem cùng nhau,<br />
                  <span className="bg-gradient-primary bg-clip-text text-transparent">Cảm nhận cùng nhau</span>
                </h1>
                <p className="text-xl md:text-2xl text-foreground/90 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-150">
                  Trải nghiệm phim với bạn bè trong sự đồng bộ hoàn hảo.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                  <Button size="lg" className="bg-gradient-primary text-lg px-8 py-6 shadow-glow" onClick={() => document.getElementById('movie-section')?.scrollIntoView({ behavior: 'smooth' })}>
                    <Play className="mr-2 h-5 w-5" /> Khám phá ngay
                  </Button>
                </div>
              </div>
            </section>
        )}

        {!searchKeyword && (
            <section className="py-20 bg-card/50">
              <div className="container mx-auto px-4">
                <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
                  Tại sao chọn <span className="text-primary">WatchTogether</span>?
                </h2>

                <div className="grid md:grid-cols-3 gap-8">
                  <div className="p-6 rounded-lg bg-background border border-border hover:border-primary transition-all duration-300 hover:shadow-glow space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <Users className="h-6 w-6 text-white"/>
                    </div>
                    <h3 className="text-xl font-bold">Xem cùng nhau</h3>
                    <p className="text-muted-foreground">Phát đồng bộ hoàn hảo với bạn bè và gia đình.</p>
                  </div>

                  <div className="p-6 rounded-lg bg-background border border-border hover:border-primary transition-all duration-300 hover:shadow-glow space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <Film className="h-6 w-6 text-white"/>
                    </div>
                    <h3 className="text-xl font-bold">Thư viện khổng lồ</h3>
                    <p className="text-muted-foreground">Hàng nghìn bộ phim và chương trình truyền hình.</p>
                  </div>

                  <div className="p-6 rounded-lg bg-background border border-border hover:border-primary transition-all duration-300 hover:shadow-glow space-y-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                      <Star className="h-6 w-6 text-white"/>
                    </div>
                    <h3 className="text-xl font-bold">Đánh giá & Nhận xét</h3>
                    <p className="text-muted-foreground">Chia sẻ suy nghĩ của bạn với cộng đồng.</p>
                  </div>
                </div>
              </div>
            </section>
        )}

        {/* --- KHU VỰC GỢI Ý PHIM AI ĐÃ ĐƯỢC TRANG TRÍ --- */}
        {/* Chỉ hiện khu vực này khi người dùng ĐÃ ĐĂNG NHẬP (có userId) và KHÔNG TÌM KIẾM */}
        {!searchKeyword && userId && (
            <section className="py-16 relative overflow-hidden">
              {/* Hiệu ứng hào quang mờ ở background */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

              <div className="container mx-auto px-4 relative z-10">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8">
                  {/* Icon nổi bật */}
                  <div className="p-4 bg-gradient-primary rounded-2xl shadow-glow inline-flex w-fit">
                    <Sparkles className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl md:text-4xl font-bold">
                      Dành riêng cho <span className="text-primary">Bạn</span>
                    </h2>
                    <p className="text-muted-foreground mt-2 text-lg">
                      AI của chúng tôi đã chọn lọc những bộ phim này dựa trên sở thích của bạn.
                    </p>
                  </div>
                </div>

                {/* Gọi Component Slider và truyền ID thật vào */}
                <div className="bg-card/30 p-6 rounded-2xl border border-border">
                  <RecommendedSlider userId={userId} />
                </div>
              </div>
            </section>
        )}

        <section id="movie-section" className={`py-20 ${searchKeyword ? 'mt-16' : ''}`}>
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                {searchKeyword ? (
                    <>
                      <Search className="h-8 w-8 text-primary"/>
                      <div>
                        <h2 className="text-3xl font-bold">Kết quả tìm kiếm</h2>
                        <p className="text-muted-foreground">Từ khóa: <span className="text-primary font-bold">"{searchKeyword}"</span></p>
                      </div>
                    </>
                ) : (
                    <>
                      <TrendingUp className="h-8 w-8 text-primary"/>
                      <h2 className="text-3xl md:text-4xl font-bold">Phim mới cập nhật</h2>
                    </>
                )}
              </div>

              {searchKeyword && (
                  <Button variant="outline" onClick={clearSearch} className="gap-2">
                    <X className="h-4 w-4"/> Quay lại trang chủ
                  </Button>
              )}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4"/>
                  <p className="text-muted-foreground">Đang tải phim...</p>
                </div>
            ) : (
                <>
                  {movies.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                        {movies.map((movie) => (
                            <MovieCard
                                key={movie.id}
                                id={movie.id}
                                title={movie.title}
                                poster={movie.poster}
                                rating={movie.rating}
                                year={movie.releaseYear?.toString()}
                                duration={`${movie.duration}`}
                                genre={movie.category?.name}
                            />
                        ))}
                      </div>
                  ) : (
                      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-border rounded-xl bg-card/30">
                        <Frown className="h-16 w-16 mb-4 opacity-50 text-muted-foreground" />
                        <h3 className="text-xl font-bold mb-2">Không tìm thấy phim nào</h3>
                        <p className="text-muted-foreground mb-6">Thử tìm kiếm với từ khóa khác xem sao?</p>
                        <Button onClick={clearSearch} className="bg-gradient-primary">
                          Xem tất cả phim
                        </Button>
                      </div>
                  )}
                </>
            )}
          </div>
        </section>

        <footer className="py-12 border-t border-border mt-auto">
          <div className="container mx-auto px-4 text-center md:text-left">
            <p className="text-muted-foreground text-sm">© 2025 WatchTogether - Đồ án cơ sở 4.</p>
          </div>
        </footer>
      </div>
  );
};

export default Index;