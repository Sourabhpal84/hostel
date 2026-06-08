import { Complaint, Notice, Room, SiteSettings, Student } from "./types";

export const settings: SiteSettings = {
  pgName: "Ap boys hostel",
  logoUrl: "",
  heroBanner: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1800&q=90",
  about: "A premium PG built for students who want comfort, safety, good food, transparent fees, and fast support in one professionally managed place.",
  contactNumber: "+91 98765 43210",
  whatsappNumber: "+91 98765 43210",
  address: "Near Main Market, Sector 21, New Delhi",
  googleMapsLink: "https://maps.google.com",
  facilities: ["High-speed WiFi", "Housekeeping", "Laundry", "CCTV Security", "RO Water", "Power Backup", "Study Lounge", "Healthy Meals"],
  foodTimetable: {
    Monday: { breakfast: "Poha + Tea", lunch: "Dal Rice + Sabzi", dinner: "Paneer + Roti" },
    Tuesday: { breakfast: "Paratha + Curd", lunch: "Rajma Rice", dinner: "Mix Veg + Roti" },
    Wednesday: { breakfast: "Idli Sambhar", lunch: "Chole Rice", dinner: "Dal Makhani + Roti" },
    Thursday: { breakfast: "Bread Omelette", lunch: "Kadhi Rice", dinner: "Aloo Gobhi + Roti" },
    Friday: { breakfast: "Upma + Tea", lunch: "Veg Pulao", dinner: "Chicken/Paneer + Roti" },
    Saturday: { breakfast: "Poori Sabzi", lunch: "Dal Fry + Rice", dinner: "Noodles + Manchurian" },
    Sunday: { breakfast: "Aloo Paratha", lunch: "Special Thali", dinner: "Light Khichdi" }
  },
  magneetoz: {
    enabled: true,
    restaurantName: "MAGNEETOZ - the taste of attraction",
    title: "Use this coupon and get instant off on your next order",
    description: "Premium food offers for visitors, students and hostel staff. Click the offer and grab the latest deal directly on Magneetoz.",
    couponText: "USE COUPON: HOSTELLOVE",
    buttonText: "Claim Offer",
    bannerUrl: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1800&q=90"
  }
};

export const rooms: Room[] = [
  {
    id: "room-201",
    roomNumber: "201",
    totalBeds: 1,
    occupiedBeds: 0,
    accommodationType: "AC",
    photos: ["https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=900&q=85"],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  },
  {
    id: "room-202",
    roomNumber: "202",
    totalBeds: 2,
    occupiedBeds: 1,
    accommodationType: "Non AC",
    photos: ["https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=900&q=85"],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  },
  {
    id: "room-301",
    roomNumber: "301",
    totalBeds: 3,
    occupiedBeds: 2,
    accommodationType: "AC",
    photos: ["https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85"],
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ"
  }
];

export const students: Student[] = [
  {
    id: "u1",
    studentId: "IPG-1001",
    fullName: "Rahul Sharma",
    fatherName: "Mahesh Sharma",
    phone: "9999999999",
    email: "rahul@student.com",
    password: "123456",
    aadhaar: "XXXX-XXXX-1234",
    address: "Jaipur, Rajasthan",
    joiningDate: "2026-06-01",
    roomNumber: "202",
    bedNumber: "B1",
    roomType: "Double Seater",
    accommodationType: "Non AC",
    rentAmount: 9500,
    securityAmount: 5000,
    paidAmount: 12000,
    dueDate: "2026-07-07",
    paymentHistory: [{ id: "pay-1", amount: 12000, date: "2026-06-01", mode: "Cash", receiptId: "REC-1001" }]
  }
];

export const notices: Notice[] = [
  { id: "n1", title: "Monthly Fees Reminder", description: "Please clear monthly rent before the 7th.", priority: "High", date: "2026-06-08" },
  { id: "n2", title: "Sunday Special Lunch", description: "Special thali will be served this Sunday.", priority: "Normal", date: "2026-06-08" }
];

export const complaints: Complaint[] = [
  {
    id: "c1",
    studentName: "Rahul Sharma",
    studentId: "IPG-1001",
    roomNumber: "202",
    bedNumber: "B1",
    category: "WiFi",
    description: "Internet speed is slow at night.",
    status: "Pending",
    remarks: "",
    createdAt: "2026-06-08"
  }
];
