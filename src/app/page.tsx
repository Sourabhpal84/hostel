"use client";

import {
  BarChart3,
  BedDouble,
  Bell,
  CheckCircle2,
  CreditCard,
  LogOut,
  Menu,
  Moon,
  Play,
  Shield,
  Utensils,
  Wrench,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { complaints as seedComplaints, notices as seedNotices, rooms as seedRooms, settings as seedSettings, students as seedStudents } from "@/lib/mock-data";
import type { Complaint, Notice, Payment, Room, SiteSettings, Student } from "@/lib/types";

type View = "public" | "adminLogin" | "studentLogin" | "admin" | "student";
type Store = {
  settings: SiteSettings;
  students: Student[];
  notices: Notice[];
  complaints: Complaint[];
  rooms: Room[];
};

const seedStore: Store = {
  settings: seedSettings,
  students: seedStudents,
  notices: seedNotices,
  complaints: seedComplaints,
  rooms: seedRooms
};

const days = Object.keys(seedSettings.foodTimetable);
const adminEmail = "admin@pg.com";
const adminPassword = "admin123";

export default function Home() {
  const [store, setStore] = useState<Store>(seedStore);
  const [view, setView] = useState<View>("public");
  const [activeStudentId, setActiveStudentId] = useState<string>("");
  const [dark, setDark] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("premiumPgStore");
    if (saved) setStore(JSON.parse(saved));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("premiumPgStore", JSON.stringify(store));
  }, [store]);

  const activeStudent = store.students.find((student) => student.studentId === activeStudentId) || store.students[0];

  const stats = useMemo(() => {
    const totalBeds = store.rooms.reduce((sum, room) => sum + room.totalBeds, 0);
    const occupied = store.rooms.reduce((sum, room) => sum + room.occupiedBeds, 0);
    const collection = store.students.reduce((sum, student) => sum + student.paidAmount, 0);
    const pending = store.students.reduce((sum, student) => sum + balance(student), 0);
    return {
      occupied,
      vacant: totalBeds - occupied,
      collection,
      pending,
      complaintsPending: store.complaints.filter((item) => item.status !== "Resolved").length,
      complaintsResolved: store.complaints.filter((item) => item.status === "Resolved").length
    };
  }, [store]);

  function patchStore(patch: Partial<Store>) {
    setStore((current) => ({ ...current, ...patch }));
  }

  function addStudent(formData: FormData) {
    const student: Student = {
      id: crypto.randomUUID(),
      studentId: `IPG-${1000 + store.students.length + 1}`,
      fullName: String(formData.get("fullName")),
      fatherName: String(formData.get("fatherName")),
      phone: String(formData.get("phone")),
      email: String(formData.get("email")),
      password: String(formData.get("password")),
      aadhaar: String(formData.get("aadhaar")),
      address: String(formData.get("address")),
      joiningDate: String(formData.get("joiningDate")),
      roomNumber: String(formData.get("roomNumber")),
      bedNumber: String(formData.get("bedNumber")),
      roomType: formData.get("roomType") as Student["roomType"],
      accommodationType: formData.get("accommodationType") as Student["accommodationType"],
      rentAmount: Number(formData.get("rentAmount")),
      securityAmount: Number(formData.get("securityAmount")),
      paidAmount: Number(formData.get("paidAmount")),
      dueDate: String(formData.get("dueDate")),
      paymentHistory: []
    };
    const rooms = store.rooms.map((room) =>
      room.roomNumber === student.roomNumber ? { ...room, occupiedBeds: Math.min(room.totalBeds, room.occupiedBeds + 1) } : room
    );
    patchStore({ students: [student, ...store.students], rooms });
    setMessage(`Admission added. Student login: ${student.email} / ${student.password}`);
  }

  function addPayment(studentId: string, amount: number, mode: Payment["mode"] = "Cash") {
    const payment: Payment = {
      id: crypto.randomUUID(),
      amount,
      mode,
      date: new Date().toISOString().slice(0, 10),
      receiptId: `REC-${Date.now()}`
    };
    patchStore({
      students: store.students.map((student) =>
        student.studentId === studentId
          ? { ...student, paidAmount: student.paidAmount + amount, paymentHistory: [payment, ...student.paymentHistory] }
          : student
      )
    });
  }

  async function payOnline(student: Student) {
    const amount = Math.max(balance(student), student.rentAmount);
    try {
      const response = await fetch("/api/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, receipt: `REC-${student.studentId}-${Date.now()}` })
      });
      if (!response.ok) throw new Error("Razorpay keys missing");
      const order = await response.json();
      const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      const razorpay = typeof window !== "undefined" ? (window as unknown as { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay : undefined;
      if (razorpay && razorpayKey) {
        new razorpay({
          key: razorpayKey,
          amount: order.amount,
          currency: order.currency,
          name: store.settings.pgName,
          description: `Fee payment for ${student.studentId}`,
          order_id: order.id,
          handler: () => {
            addPayment(student.studentId, amount, "Razorpay");
            setMessage("Payment successful. Student fee dashboard updated.");
          },
          prefill: { name: student.fullName, email: student.email, contact: student.phone },
          theme: { color: "#141414" }
        }).open();
      } else {
        addPayment(student.studentId, amount, "Razorpay");
        setMessage("Razorpay order created. Add checkout script on deployment for live popup.");
      }
    } catch {
      addPayment(student.studentId, amount, "Razorpay");
      setMessage("Demo payment recorded. Add Razorpay keys on Vercel for live checkout.");
    }
  }

  function submitStudentLogin(formData: FormData) {
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const student = store.students.find((item) => item.email === email && item.password === password);
    if (!student) {
      setMessage("Student email/password match nahi hua.");
      return;
    }
    setActiveStudentId(student.studentId);
    setView("student");
    setMessage("");
  }

  function submitAdminLogin(formData: FormData) {
    if (formData.get("email") === adminEmail && formData.get("password") === adminPassword) {
      setView("admin");
      setMessage("");
      return;
    }
    setMessage("Admin email/password galat hai.");
  }

  const shellClass = dark ? "min-h-screen bg-zinc-950 text-white" : "min-h-screen";

  return (
    <main className={shellClass}>
      <Header view={view} setView={setView} dark={dark} setDark={setDark} />
      {message && <div className="mx-5 mt-4 rounded-lg bg-amber-100 px-4 py-3 font-bold text-amber-950 lg:mx-14">{message}</div>}
      {store.settings.magneetoz.enabled && <MagneetozBanner settings={store.settings} />}
      {view === "public" && <PublicSite store={store} />}
      {view === "adminLogin" && <Login title="Admin Login" hint="Demo: admin@pg.com / admin123" onSubmit={submitAdminLogin} />}
      {view === "studentLogin" && <Login title="Student Login" hint="Demo: rahul@student.com / 123456" onSubmit={submitStudentLogin} />}
      {view === "admin" && (
        <AdminDashboard
          store={store}
          stats={stats}
          patchStore={patchStore}
          addStudent={addStudent}
          addPayment={addPayment}
        />
      )}
      {view === "student" && activeStudent && (
        <StudentDashboard
          store={store}
          student={activeStudent}
          patchStore={patchStore}
          payOnline={payOnline}
        />
      )}
    </main>
  );
}

function Header({ view, setView, dark, setDark }: { view: View; setView: (view: View) => void; dark: boolean; setDark: (value: boolean) => void }) {
  return (
    <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 bg-white/85 px-5 py-3 text-zinc-950 backdrop-blur-xl lg:px-14">
      <button className="flex items-center gap-3" onClick={() => setView("public")}>
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-zinc-950 font-black text-amber-200">IP</span>
        <span className="text-left">
          <strong className="block text-lg">Imperial PG</strong>
          <small className="text-zinc-500">Premium PG Management</small>
        </span>
      </button>
      <nav className="hidden gap-6 font-bold lg:flex">
        {["About", "Rooms", "Gallery", "Facilities", "Food Timetable", "Notices", "Contact"].map((item) => (
          <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`}>{item}</a>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-light" onClick={() => setDark(!dark)} aria-label="Toggle dark mode"><Moon size={18} /></button>
        {view === "admin" || view === "student" ? (
          <button className="btn btn-dark" onClick={() => setView("public")}><LogOut size={17} /> Logout</button>
        ) : (
          <>
            <button className="btn btn-light" onClick={() => setView("studentLogin")}>Student Login</button>
            <button className="btn btn-dark" onClick={() => setView("adminLogin")}>Admin Login</button>
          </>
        )}
        <button className="btn btn-light lg:hidden" aria-label="Open menu"><Menu size={18} /></button>
      </div>
    </header>
  );
}

function Login({ title, hint, onSubmit }: { title: string; hint: string; onSubmit: (formData: FormData) => void }) {
  return (
    <section className="section mx-auto max-w-xl">
      <form action={onSubmit} className="premium-card grid gap-4 p-6">
        <p className="eyebrow">Secure Access</p>
        <h1 className="text-4xl font-black">{title}</h1>
        <p className="text-zinc-500">{hint}</p>
        <input className="field" name="email" type="email" placeholder="Email" required />
        <input className="field" name="password" type="password" placeholder="Password" required />
        <button className="btn btn-dark">Login</button>
      </form>
    </section>
  );
}

function MagneetozBanner({ settings }: { settings: SiteSettings }) {
  return (
    <a href="https://magneetoz.com" target="_blank" rel="noreferrer" className="mx-5 mt-4 grid overflow-hidden rounded-lg border border-amber-900/10 bg-white text-zinc-950 shadow-xl lg:mx-14 lg:grid-cols-[42%_1fr]">
      <img src={settings.magneetoz.bannerUrl} alt="Magneetoz promotional offer" className="h-48 w-full object-cover lg:h-36" />
      <div className="flex items-center justify-between gap-4 p-5">
        <div>
          <p className="eyebrow">Promotional Offer</p>
          <h2 className="text-2xl font-black">{settings.magneetoz.title}</h2>
          <p className="text-zinc-600">{settings.magneetoz.description}</p>
        </div>
        <span className="btn btn-dark shrink-0">Visit</span>
      </div>
    </a>
  );
}

function PublicSite({ store }: { store: Store }) {
  return (
    <>
      <section className="relative min-h-[78vh] overflow-hidden">
        <img src={store.settings.heroBanner} alt="Premium PG room" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
        <div className="relative max-w-4xl px-6 py-28 text-white lg:px-20 lg:py-36">
          <p className="eyebrow">Luxury Hotel Style PG</p>
          <h1 className="text-6xl font-black leading-none lg:text-8xl">{store.settings.pgName}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/86">{store.settings.about}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="btn bg-amber-300 text-zinc-950" href="#rooms">Explore Rooms</a>
            <a className="btn border border-white/30 bg-white/10 text-white" href="#contact">Contact PG</a>
          </div>
        </div>
      </section>
      <section id="facilities" className="section">
        <p className="eyebrow">Facilities</p>
        <h2 className="mt-2 max-w-3xl text-4xl font-black">Comfort, safety, and premium student living in one place.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {store.settings.facilities.map((item) => <div className="premium-card p-5 font-bold text-zinc-950" key={item}><CheckCircle2 className="mb-4 text-emerald-700" />{item}</div>)}
        </div>
      </section>
      <section id="rooms" className="section bg-zinc-950 text-white">
        <p className="eyebrow">Room Types</p>
        <h2 className="mt-2 text-4xl font-black">Rooms, photos, rent, beds and videos.</h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {store.rooms.map((room) => <RoomCard key={room.id} room={room} />)}
        </div>
      </section>
      <section id="food-timetable" className="section">
        <p className="eyebrow">Food Timetable</p>
        <h2 className="mt-2 text-4xl font-black">Weekly breakfast, lunch and dinner.</h2>
        <div className="mt-8 grid gap-3 lg:grid-cols-7">
          {days.map((day) => <MealCard key={day} day={day} settings={store.settings} />)}
        </div>
      </section>
      <section id="notices" className="section bg-white text-zinc-950">
        <p className="eyebrow">Notices</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">{store.notices.map((notice) => <NoticeCard key={notice.id} notice={notice} />)}</div>
      </section>
      <section id="contact" className="section">
        <div className="premium-card grid gap-6 p-7 text-zinc-950 lg:grid-cols-2">
          <div>
            <p className="eyebrow">Contact</p>
            <h2 className="mt-2 text-4xl font-black">Visit or call for admission.</h2>
            <p className="mt-4 text-zinc-600">{store.settings.address}</p>
            <p className="mt-2 font-bold">{store.settings.contactNumber}</p>
          </div>
          <iframe src={store.settings.googleMapsLink} className="h-72 w-full rounded-lg border-0" title="PG location map" />
        </div>
      </section>
    </>
  );
}

function AdminDashboard({ store, stats, patchStore, addStudent, addPayment }: {
  store: Store;
  stats: { occupied: number; vacant: number; collection: number; pending: number; complaintsPending: number; complaintsResolved: number };
  patchStore: (patch: Partial<Store>) => void;
  addStudent: (formData: FormData) => void;
  addPayment: (studentId: string, amount: number, mode?: Payment["mode"]) => void;
}) {
  const statItems: Array<[string, string | number, LucideIcon]> = [
    ["Total Students", store.students.length, BedDouble],
    ["Occupied Beds", stats.occupied, Shield],
    ["Vacant Beds", stats.vacant, BedDouble],
    ["Monthly Collection", money(stats.collection), CreditCard],
    ["Pending Fees", money(stats.pending), BarChart3],
    ["Complaints Pending", stats.complaintsPending, Wrench],
    ["Complaints Resolved", stats.complaintsResolved, CheckCircle2],
    ["Active Notices", store.notices.length, Bell]
  ];

  return (
    <section className="section">
      <p className="eyebrow">Admin Panel</p>
      <h1 className="mt-2 text-5xl font-black">Hostel Control Center</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statItems.map(([label, value, Icon]) => (
          <div className="premium-card p-5 text-zinc-950" key={label}>
            <Icon className="mb-4 text-amber-700" size={24} />
            <strong className="block text-2xl">{value}</strong>
            <span className="text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <form action={addStudent} className="premium-card grid gap-3 p-5 text-zinc-950">
          <h2 className="text-2xl font-black">New Admission</h2>
          {["fullName", "fatherName", "phone", "email", "password", "aadhaar", "address", "joiningDate", "roomNumber", "bedNumber", "rentAmount", "securityAmount", "paidAmount", "dueDate"].map((name) => (
            <input key={name} name={name} className="field" placeholder={labelize(name)} required />
          ))}
          <select name="roomType" className="field"><option>Single Seater</option><option>Double Seater</option><option>Triple Seater</option></select>
          <select name="accommodationType" className="field"><option>AC</option><option>Non AC</option></select>
          <button className="btn btn-dark">Add Student</button>
        </form>

        <div className="premium-card p-5 text-zinc-950 lg:col-span-2">
          <h2 className="text-2xl font-black">Students, Fees & Payment History</h2>
          <div className="mt-4 grid gap-3">
            {store.students.map((student) => (
              <div className="rounded-lg border border-black/10 p-4" key={student.id}>
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <strong>{student.fullName}</strong>
                    <p className="text-sm text-zinc-500">{student.studentId} | {student.email} | Room {student.roomNumber}, Bed {student.bedNumber}</p>
                    <p className="text-sm">Paid {money(student.paidAmount)} | Remaining {money(balance(student))} | Due {student.dueDate}</p>
                  </div>
                  <button className="btn btn-dark" onClick={() => addPayment(student.studentId, 1000)}>Add Rs. 1,000</button>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-zinc-500">
                  {student.paymentHistory.map((payment) => <span key={payment.id}>{payment.date} | {payment.mode} | {money(payment.amount)} | {payment.receiptId}</span>)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <AdminContent store={store} patchStore={patchStore} />
      </div>
    </section>
  );
}

function AdminContent({ store, patchStore }: { store: Store; patchStore: (patch: Partial<Store>) => void }) {
  return (
    <>
      <form className="premium-card grid gap-3 p-5 text-zinc-950" action={(data) => patchStore({ settings: { ...store.settings, pgName: String(data.get("pgName") || store.settings.pgName), about: String(data.get("about") || store.settings.about), heroBanner: String(data.get("heroBanner") || store.settings.heroBanner), contactNumber: String(data.get("contactNumber") || store.settings.contactNumber), address: String(data.get("address") || store.settings.address), magneetoz: { ...store.settings.magneetoz, title: String(data.get("offerTitle") || store.settings.magneetoz.title), description: String(data.get("offerDescription") || store.settings.magneetoz.description), bannerUrl: String(data.get("offerBanner") || store.settings.magneetoz.bannerUrl), enabled: data.get("offerEnabled") === "on" } } })}>
        <h2 className="text-2xl font-black">Website Settings</h2>
        <input name="pgName" className="field" placeholder="PG Name" />
        <textarea name="about" className="field" placeholder="About content" />
        <input name="heroBanner" className="field" placeholder="Hero banner URL" />
        <input name="contactNumber" className="field" placeholder="Contact number" />
        <input name="address" className="field" placeholder="Address" />
        <input name="offerTitle" className="field" placeholder="Magneetoz offer title" />
        <input name="offerDescription" className="field" placeholder="Magneetoz offer description" />
        <input name="offerBanner" className="field" placeholder="Magneetoz banner URL" />
        <label className="flex gap-2 font-bold"><input name="offerEnabled" type="checkbox" defaultChecked={store.settings.magneetoz.enabled} /> Enable offer</label>
        <button className="btn btn-dark">Update Website</button>
      </form>

      <form className="premium-card grid gap-3 p-5 text-zinc-950" action={(data) => patchStore({ notices: [{ id: crypto.randomUUID(), title: String(data.get("title")), description: String(data.get("description")), priority: data.get("priority") as Notice["priority"], date: new Date().toISOString().slice(0, 10) }, ...store.notices] })}>
        <h2 className="text-2xl font-black">Notice Management</h2>
        <input name="title" className="field" placeholder="Notice title" required />
        <textarea name="description" className="field" placeholder="Notice description" required />
        <select name="priority" className="field"><option>Normal</option><option>High</option><option>Low</option></select>
        <button className="btn btn-dark">Create Notice</button>
      </form>

      <div className="premium-card p-5 text-zinc-950">
        <h2 className="text-2xl font-black">Complaints</h2>
        <div className="mt-4 grid gap-3">
          {store.complaints.map((item) => (
            <div key={item.id} className="rounded-lg border border-black/10 p-3">
              <strong>{item.category}</strong>
              <p className="text-sm text-zinc-500">{item.studentName} | {item.roomNumber}/{item.bedNumber} | {item.status}</p>
              <p className="mt-2 text-sm">{item.description}</p>
              <div className="mt-3 flex gap-2">
                {(["Pending", "In Progress", "Resolved"] as Complaint["status"][]).map((status) => (
                  <button key={status} className="btn btn-light" onClick={() => patchStore({ complaints: store.complaints.map((c) => c.id === item.id ? { ...c, status, remarks: status === "Resolved" ? "Resolved by admin" : c.remarks } : c) })}>{status}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form className="premium-card grid gap-3 p-5 text-zinc-950" action={(data) => patchStore({ rooms: [{ id: crypto.randomUUID(), roomNumber: String(data.get("roomNumber")), totalBeds: Number(data.get("totalBeds")), occupiedBeds: 0, accommodationType: data.get("accommodationType") as Room["accommodationType"], photos: [String(data.get("photo"))], videoUrl: String(data.get("videoUrl")) }, ...store.rooms] })}>
        <h2 className="text-2xl font-black">Room Management</h2>
        <input name="roomNumber" className="field" placeholder="Room number" required />
        <input name="totalBeds" className="field" placeholder="Total beds" required />
        <select name="accommodationType" className="field"><option>AC</option><option>Non AC</option></select>
        <input name="photo" className="field" placeholder="Room photo URL" required />
        <input name="videoUrl" className="field" placeholder="YouTube embed URL" />
        <button className="btn btn-dark">Add Room</button>
      </form>
    </>
  );
}

function StudentDashboard({ store, student, patchStore, payOnline }: { store: Store; student: Student; patchStore: (patch: Partial<Store>) => void; payOnline: (student: Student) => void }) {
  const myComplaints = store.complaints.filter((item) => item.studentId === student.studentId);
  return (
    <section className="section">
      <p className="eyebrow">Student Dashboard</p>
      <h1 className="mt-2 text-5xl font-black">Welcome, {student.fullName}</h1>
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Profile</h2><p className="mt-3 text-zinc-600">{student.studentId} | Room {student.roomNumber}, Bed {student.bedNumber}</p><p>{student.roomType} | {student.accommodationType}</p></div>
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Fees</h2><p>Total: {money(student.rentAmount + student.securityAmount)}</p><p>Paid: {money(student.paidAmount)}</p><p>Remaining: {money(balance(student))}</p><button className="btn btn-dark mt-4" onClick={() => payOnline(student)}>Pay Online</button></div>
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Emergency</h2><p>{store.settings.contactNumber}</p><p>WhatsApp: {store.settings.whatsappNumber}</p></div>
      </div>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Latest Notices</h2>{store.notices.map((notice) => <NoticeCard key={notice.id} notice={notice} />)}</div>
        <form className="premium-card grid gap-3 p-5 text-zinc-950" action={(data) => patchStore({ complaints: [{ id: crypto.randomUUID(), studentName: student.fullName, studentId: student.studentId, roomNumber: student.roomNumber, bedNumber: student.bedNumber, category: data.get("category") as Complaint["category"], description: String(data.get("description")), status: "Pending", remarks: "", createdAt: new Date().toISOString().slice(0, 10) }, ...store.complaints] })}>
          <h2 className="text-2xl font-black">Complaint Box</h2>
          <select name="category" className="field"><option>Electricity</option><option>Water</option><option>Cleaning</option><option>Food</option><option>WiFi</option><option>Furniture</option><option>Other</option></select>
          <textarea name="description" className="field" placeholder="Describe your complaint" required />
          <button className="btn btn-dark">Submit Complaint</button>
        </form>
      </div>
      <div className="mt-6 grid gap-3 lg:grid-cols-7">{days.map((day) => <MealCard key={day} day={day} settings={store.settings} />)}</div>
      <div className="premium-card mt-6 p-5 text-zinc-950">
        <h2 className="text-2xl font-black">Complaint History</h2>
        {myComplaints.map((item) => <div key={item.id} className="mt-3 rounded-lg border border-black/10 p-3"><strong>{item.category}</strong><p>{item.status}</p><p className="text-sm text-zinc-500">{item.description}</p></div>)}
      </div>
    </section>
  );
}

function RoomCard({ room }: { room: Room }) {
  const available = room.totalBeds - room.occupiedBeds;
  return (
    <article className="overflow-hidden rounded-lg border border-white/10 bg-white/10">
      <img src={room.photos[0]} alt={`Room ${room.roomNumber}`} className="h-60 w-full object-cover" />
      <div className="p-5">
        <h3 className="text-2xl font-black">Room {room.roomNumber}</h3>
        <p className="mt-2 text-white/70">{room.accommodationType} | {room.totalBeds} beds | {available} available</p>
        <a className="btn mt-4 bg-white text-zinc-950" href={room.videoUrl} target="_blank" rel="noreferrer"><Play size={17} /> Watch Video</a>
      </div>
    </article>
  );
}

function MealCard({ day, settings }: { day: string; settings: SiteSettings }) {
  const meal = settings.foodTimetable[day];
  return <div className="premium-card p-4 text-zinc-950"><Utensils className="mb-3 text-amber-700" /><strong>{day}</strong><p className="mt-2 text-sm text-zinc-600">{meal.breakfast}<br />{meal.lunch}<br />{meal.dinner}</p></div>;
}

function NoticeCard({ notice }: { notice: Notice }) {
  return <div className="mt-3 rounded-lg border border-black/10 p-4"><strong>{notice.title}</strong><p className="text-sm text-zinc-500">{notice.date} | {notice.priority}</p><p className="mt-2">{notice.description}</p></div>;
}

function balance(student: Student) {
  return Math.max(student.rentAmount + student.securityAmount - student.paidAmount, 0);
}

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}
