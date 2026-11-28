// Cấu hình công khai của Hệ thống cố vấn học tập (PNA) — không chứa mật khẩu hay client secret.
// Quyền đọc/ghi do Quy tắc bảo mật Firestore (firestore.rules) quyết định.
// PNA dùng DỰ ÁN FIREBASE RIÊNG, không dùng chung phuc-nguyen-library của PND/PNL/PNW.
window.PNA_CONFIG = {
  // Dán nguyên khối firebaseConfig của dự án PNA (Firebase Console → Project settings → Your apps → Web app → Config)
  FIREBASE: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  // OAuth client web (Google Cloud của dự án PNA → APIs & Services → Credentials) — gia hạn quyền Drive ngầm
  CLIENT_ID: "",
  // Khóa API đọc thư mục Drive đã chia sẻ "Bất kỳ ai có đường liên kết"; giới hạn theo luuhuongnnpl-apag.github.io
  DRIVE_KEY: "",
  // Dự án riêng chưa có tài khoản quản trị email/mật khẩu chung; quản trị đăng nhập bằng Google
  ADMIN_UID: "",
  ADMIN_EMAILS: ["luuhuong.dhnv@gmail.com", "luuhuong.nnpl@gmail.com"],
  // Tài khoản Google sở hữu thư mục gốc "PNA - Hệ thống cố vấn học tập" trên Drive
  DRIVE_OWNER: "luuhuong.dhnv@gmail.com",
  // Khóa reCAPTCHA Enterprise cho App Check (bật Hỏi AI); để trống thì nút Hỏi AI báo chờ kích hoạt
  APPCHECK_SITE_KEY: "",
  AI_MODEL: "gemini-3.8-flash",
  LINKS: {
    portal: "",
    drive: "https://drive.google.com/drive/my-drive",
    gmail: "https://mail.google.com/mail/"
  }
};
