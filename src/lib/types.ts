export type Role = "admin" | "student";

export type Student = {
  id: string;
  studentId: string;
  fullName: string;
  fatherName: string;
  phone: string;
  email: string;
  password?: string;
  aadhaar: string;
  address: string;
  joiningDate: string;
  roomNumber: string;
  bedNumber: string;
  roomType: "Single Seater" | "Double Seater" | "Triple Seater";
  accommodationType: "AC" | "Non AC";
  rentAmount: number;
  securityAmount: number;
  paidAmount: number;
  dueDate: string;
  paymentHistory: Payment[];
  alerts?: string[];
  status?: "Active" | "Left";
  exitDate?: string;
};

export type Payment = {
  id: string;
  amount: number;
  date: string;
  mode: "Cash" | "UPI" | "Razorpay" | "Bank";
  receiptId: string;
};

export type Notice = {
  id: string;
  title: string;
  description: string;
  priority: "Low" | "Normal" | "High";
  date: string;
};

export type Complaint = {
  id: string;
  studentName: string;
  studentId: string;
  roomNumber: string;
  bedNumber: string;
  category: "Electricity" | "Water" | "Cleaning" | "Food" | "WiFi" | "Furniture" | "Other";
  description: string;
  status: "Pending" | "In Progress" | "Resolved";
  remarks: string;
  createdAt: string;
};

export type Room = {
  id: string;
  roomNumber: string;
  totalBeds: number;
  occupiedBeds: number;
  accommodationType: "AC" | "Non AC";
  photos: string[];
  videoUrl: string;
};

export type SiteSettings = {
  pgName: string;
  logoUrl: string;
  heroBanner: string;
  about: string;
  contactNumber: string;
  whatsappNumber: string;
  address: string;
  googleMapsLink: string;
  facilities: string[];
  foodTimetable: Record<string, { breakfast: string; lunch: string; dinner: string }>;
  magneetoz: {
    enabled: boolean;
    restaurantName: string;
    title: string;
    description: string;
    discountDetails: string;
    couponText: string;
    referralCodePrefix: string;
    referralEnabled: boolean;
    buttonText: string;
    bannerUrl: string;
    foodImages: string[];
    websiteLink: string;
    whatsappLink: string;
    instagramLink: string;
    qrCodes: string[];
    videos: string[];
  };
};

export type MagneetozReferralEvent = {
  id: string;
  pgSourceId: string;
  pgName: string;
  referralCode: string;
  eventType: "click" | "order";
  createdAt: string;
  orderValue?: number;
};

export type ConnectedPgSite = {
  id: string;
  name: string;
  sourceId: string;
};
