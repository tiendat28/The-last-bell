# 🎮 SINH TỒN 3D - Tiếng Chuông Cuối Cùng (The Last Bell)
## 🏫 Thể Loại: Ma Sói Học Đường kết hợp Sinh Tồn Không Gian 3D

---

## 📜 1. Cốt Truyện & Luật Chơi Nâng Cao

Tất cả học sinh khi vào game đều xuất hiện tại một ngôi trường bí ẩn lúc nửa đêm. Ngôi trường bị một **Kết giới vô hình khổng lồ (bán kính 500m)** bao bọc. Bất kỳ ai rời khỏi kết giới này sẽ bị mất máu liên tục và chết dần.

Giữa các học sinh có những kẻ đã bị nguyền rủa biến thành **Ma Sói**. Quản trò là **Hệ thống Loa Phát Thanh Trường Học (NPC Loa Quản Trò)**, điều phối mọi biến cố và phát ra âm thanh chuông báo tử vang vọng khắp khuôn viên.

---

## 🎭 2. Chi Tiết Kỹ Năng Các Vai Trò Đặc Biệt

### 🐺 1. Ma Sói (Werewolf)
- **Đặc quyền ban đêm:** Là kẻ duy nhất được tự do di chuyển (tốc độ chạy +20%), có **quầng sáng ma quỷ bán kính 2m** quanh mình và chỉ có Sói mới nhìn thấy tên các học sinh khác trong bóng tối khi áp sát.
- **Kỹ năng:** Mỗi đêm được cắn tối đa **1 người**. Áp sát con mồi ($\le 4.5\text{m}$) và nhấn **`[F] CẮN MỤC TIÊU`**. Khi cắn, Phù Thủy lập tức nhận được thông báo để quyết định cứu hay không.

### 🔮 2. Tiên Tri (Seer)
- **Đặc quyền ban đêm:** Mặc dù bị bất động ngủ say trong phòng như các học sinh khác, Tiên Tri có nút **`🔮 DÙNG KỸ NĂNG ĐÊM`** để mở bảng thấu thị.
- **Kỹ năng:** Mỗi đêm được chọn **1 học sinh bất kỳ** để soi danh tính. Kết quả trả về ngay lập tức trên màn hình:
  - *"Học sinh [Tên]: 🐺 LÀ MA SÓI HUNG ÁC!"* hoặc *"👤 LÀ NGƯỜI LÀNH VÔ TỘI!"*.

### 🛡️ 3. Bảo Vệ (Bodyguard)
- **Đặc quyền ban đêm:** Bị bất động ngủ say nhưng có bảng **`🛡️ THIẾT LẬP KHIÊN BẢO VỆ`**.
- **Kỹ năng:** Mỗi đêm chọn 1 người để bảo vệ khỏi đòn tấn công của Ma Sói (có thể bảo vệ chính mình).
- **Quy tắc bắt buộc:** **Không được bảo vệ cùng một người trong hai đêm liên tiếp!** Có quyền chọn bỏ qua không bảo vệ ai trong đêm.

### 🧙 4. Phù Thủy (Witch)
- **Sở hữu 2 bình thuốc dùng 1 lần duy nhất trong cả trận đấu:**
  - **💉 1 Bình Cứu (Heal Potion):** Khi có học sinh bị Sói cắn trong đêm, màn hình Phù Thủy lập tức bật thông báo khẩn cấp: *"⚠️ Học sinh [Tên] vừa bị Sói cắn! Bạn có muốn dùng Bình Cứu không?"*. Nếu dùng, nạn nhân sẽ được cứu sống thần kỳ. Nếu không dùng, bình cứu được giữ lại cho các đêm sau.
  - **☠️ 1 Bình Độc (Poison Potion):** Phù Thủy có thể chọn đầu độc hạ sát 1 người bất kỳ trong đêm.
  - Có thể dùng cả 2 bình trong một đêm hoặc không dùng bình nào.

### 💥 5. Thợ Săn (Hunter)
- **Kỹ năng Phát Súng Cuối Cùng:**
  - Khi Thợ Săn bị chết (bất kể do Sói cắn trong đêm, bị Phù Thủy đầu độc, hay bị toàn trường biểu quyết treo cổ ban ngày), Thợ Săn có quyền **nổ một phát súng cuối cùng** kéo theo 1 người bất kỳ chết cùng!
  - Màn hình sẽ hiện bảng chọn mục tiêu bắn hạ kèm âm thanh súng nổ vang trời. Thợ Săn cũng có quyền buông súng không bắn ai.

---

## 📡 3. Hệ Thống Radar Bản Đồ Nhỏ (Minimap 2D) & Loa Âm Thanh

1. **Bản Đồ Nhỏ Radar (Minimap) Ở Góc Phải:**
   - Hiển thị trực quan theo thời gian thực:
     - Ranh giới kết giới tím 300m.
     - Cột cờ trung tâm $(0,0)$.
     - Tòa nhà chính (Dãy phòng học A1-A3, Nhà vệ sinh, Phòng kho).
     - Khu bể bơi trường học.
     - Chấm xanh lá và mũi tên hướng nhìn của nhân vật.
   - Hiển thị nhãn tên khu vực hiện tại người chơi đang đứng: *"🏫 Dãy Phòng Học A1-A3"*, *"🏊 Khu Bể Bơi"*, *"🚻 Nhà Vệ Sinh"*, *"📦 Phòng Kho / Gác Đồ"*, *"🏢 Sân Thượng"*, *"🚩 Sân Trường Trung Tâm"*.

2. **Hệ Thống Âm Thanh Web Audio Synthesizer Đa Tầng:**
   - **Tiếng chuông trường học:** Âm sắc chuông kim loại ngân vang khi chuyển giao Ngày - Đêm và có thông báo loa phát thanh.
   - **Tiếng chuông báo tử:** Âm trầm đục ngân dài khi có học sinh bị sát hại.
   - **Tiếng sói hú:** Vang vọng rợn người khi bóng đêm buông xuống.
   - **Tiếng súng nổ:** Tiếng đạn xé không khí khi Thợ Săn nổ súng.

---

## 🚪 4. Hệ Thống Sảnh Phòng & Chế Độ Chơi Với Máy (Bot AI)

### ➕ 1. Tạo Phòng & Chia Chức Năng Theo Chế Độ
- **Chế độ Tiêu Chuẩn 9 - 13 Người:**
  - 3 Ma Sói
  - 1 Tiên Tri
  - 1 Bảo Vệ
  - 1 Phù Thủy
  - 1 Thợ Săn
  - Các vị trí còn lại là Dân Làng / Học Sinh
- **Chế độ Đại Trường Học 14 - 16 Người:**
  - 4 Ma Sói
  - 1 Tiên Tri
  - 1 Bảo Vệ
  - 1 Phù Thủy
  - 1 Thợ Săn
  - Các vị trí còn lại là Dân Làng / Học Sinh

### 🤖 2. Chế Độ Chơi Với Máy (Bot AI Testing)
- Khi bật tùy chọn **"Chơi với Máy"** lúc tạo phòng, máy chủ sẽ tự động sinh các Bot AI thông minh lấp đầy phòng đến đúng số lượng mục tiêu (9-16 người).
- **Trí tuệ nhân tạo của Bot:**
  - **Sói Bot:** Tự động tìm kiếm con mồi còn sống và áp sát cắn trong đêm.
  - **Phù Thủy Bot:** Tự động nhận diện nạn nhân bị sói cắn và quyết định dùng bình cứu.
  - **Thợ Săn Bot:** Tự động nổ súng bắn hạ 1 người ngẫu nhiên khi bị loại.
  - **Dân Làng Bot:** Tự động tham gia thảo luận và bỏ phiếu biểu quyết vào ban ngày.
- **Thao tác nhanh trên HUD:**
  - `[🤖 LẤP ĐẦY BOT]`: Bổ sung bot cho đủ mục tiêu phòng.
  - `[+1 BOT]`: Thêm nhanh 1 bot.
  - `[XÓA BOT]`: Xóa toàn bộ bot khỏi phòng.

### 📋 3. Mời Bạn Bè Bằng Mã Phòng & Link Mời
- Mỗi phòng có một mã định danh duy nhất (Ví dụ: `ROOM-4821`).
- Bấm nút **`[📋 MỜI]`** trên góc phải màn hình để tự động sao chép đường link tham gia: `http://localhost:5173/?room=ROOM-4821`.
- Người chơi khác mở link sẽ tự động được điền mã phòng và chuyển thẳng vào tab Tham gia phòng!

---

## ⚡ 5. Công Cụ Test Nhanh Vai Trò (Tên "gibel" & Lệnh Chat)

### 👑 1. Nhân Vật "gibel" (Tự Động Trao Chức Năng):
- Đặt tên học sinh là **`gibel`** (hoặc bấm nút `[⚡ Dùng tên "gibel"]` tại sảnh):
  - Khi bắt đầu trận đấu, hệ thống sẽ **luôn ưu tiên gán vai trò đặc biệt** cho bạn (mặc định là Ma Sói để test săn mồi).
  - Có thể đặt tên kèm vai trò: `gibel_soi`, `gibel_baove`, `gibel_tientri`, `gibel_phuthuy`, `gibel_bacsi`, `gibel_thosan`.
- **Thanh công cụ Dev Cheat nổi trên HUD:**
  - Bấm chọn trực tiếp 1 click: `[🐺 SÓI]`, `[🔮 TIÊN TRI]`, `[🛡️ BẢO VỆ]`, `[🧙 PHÙ THỦY]`, `[🩺 BÁC SĨ]`, `[💥 THỢ SĂN]`.
  - Toàn bộ mô hình nhân vật, quầng sáng, bảng kỹ năng và túi thuốc sẽ chuyển đổi tức thì!

### 💬 2. Câu Lệnh Chat Đổi Chức Năng Bất Kỳ Lúc Nào:
Gõ vào khung chat Enter các lệnh sau:
- `/role soi` hoặc `/role wolf`: Đổi thành **Ma Sói**
- `/role tientri` hoặc `/role seer`: Đổi thành **Tiên Tri**
- `/role baove` hoặc `/role bodyguard`: Đổi thành **Bảo Vệ**
- `/role phuthuy` hoặc `/role witch`: Đổi thành **Phù Thủy** (hồi lại 2 bình thuốc cứu & độc)
- `/role bacsi` hoặc `/role doctor`: Đổi thành **Bác Sĩ** (bảo vệ / tiêm thuốc cứu người trong đêm)
- `/role thosan` hoặc `/role hunter`: Đổi thành **Thợ Săn**
- `/role dan` hoặc `/role villager`: Đổi thành **Dân Làng**

---

## 🎧 6. Nâng Cấp Chất Lượng Âm Thanh & Khử Rung Giật Màn Hình

1. **Âm Thanh Êm Ái - Chống Rè & Chống Đè Vọng (Anti-clipping & Debouncing):**
   - Tích hợp **Master Dynamics Compressor** và **Master Biquad Lowpass Filter (7000Hz)** triệt tiêu hoàn toàn hiện tượng vỡ tiếng/rè âm thanh khi nhiều tiếng động phát cùng lúc.
   - Thêm cơ chế **Debounce Cooldown (1.5s - 3s)**: Ngăn chặn tiếng chuông loa và tiếng sói hú bị gọi lặp đè lên nhau gây vọng âm.
   - Chuyển tiếng Sói hú sang sóng Sine/Triangle kết hợp Vibrato điện ảnh mượt mà, không dùng sóng Sawtooth rè gắt.

2. **Khử Rung Giật Màn Hình (Smooth Camera & 60 FPS Optimization):**
   - **Smooth Camera Damping (Lerp):** Camera bám theo nhân vật được khử dao động delta-time, loại bỏ 100% hiện tượng micro-jitter khi di chuyển và xoay góc nhìn.
   - **Xoay nhân vật mượt mà:** Khử hiện tượng khựng góc quay khi đổi hướng W/A/S/D.
   - **Tối ưu Shadow Map & Pixel Ratio:** Giảm shadow resolution từ 2048 xuống 1024 và khống chế pixel ratio tối đa 1.5, giải phóng GPU giúp game chạy ổn định 60 FPS không bị sụt khung hình.
   - **Throttle DOM Layout:** Giới hạn cập nhật tọa độ DOM 100ms/lần thay vì 60 lần/giây, chống giật layout trình duyệt.
