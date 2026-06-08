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
import { signInWithEmailAndPassword } from "firebase/auth";
import { complaints as seedComplaints, notices as seedNotices, rooms as seedRooms, settings as seedSettings, students as seedStudents } from "@/lib/mock-data";
import { auth } from "@/lib/firebase";
import type { Complaint, Notice, Payment, Room, SiteSettings, Student } from "@/lib/types";

type View = "public" | "adminLogin" | "studentLogin" | "magneetozLogin" | "admin" | "student" | "magneetoz";
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
const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@pg.com";
const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
const magneetozEmail = process.env.NEXT_PUBLIC_MAGNEETOZ_EMAIL || "magneetoz73@gmail.com";
const magneetozPassword = process.env.NEXT_PUBLIC_MAGNEETOZ_PASSWORD || "LURlum8423@";

export default function Home() {
  const [store, setStore] = useState<Store>(seedStore);
  const [view, setView] = useState<View>("public");
  const [activeStudentId, setActiveStudentId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentQuery, setStudentQuery] = useState("");
  const [feeFilter, setFeeFilter] = useState<"all" | "paid" | "pending">("all");
  const [dark, setDark] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("premiumPgStore");
    if (saved) setStore(normalizeStore(JSON.parse(saved)));
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
    const target = store.students.find((student) => student.studentId === studentId);
    const payableAmount = target ? Math.min(Math.max(amount, 0), balance(target)) : amount;
    if (!payableAmount) {
      setMessage("Is student ki pending fees zero hai.");
      return;
    }
    const payment: Payment = {
      id: crypto.randomUUID(),
      amount: payableAmount,
      mode,
      date: new Date().toISOString().slice(0, 10),
      receiptId: `REC-${Date.now()}`
    };
    patchStore({
      students: store.students.map((student) =>
        student.studentId === studentId
          ? { ...student, paidAmount: student.paidAmount + payableAmount, paymentHistory: [payment, ...student.paymentHistory] }
          : student
      )
    });
  }

  async function payOnline(student: Student) {
    const amount = balance(student);
    if (amount <= 0) {
      setMessage("Is student ki pending fees zero hai.");
      return;
    }
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

  async function submitStudentLogin(formData: FormData) {
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    if (auth) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch {
        setMessage("Firebase student login failed. Email/password check karo.");
        return;
      }
    }
    const student = store.students.find((item) => item.email === email && (auth || item.password === password));
    if (!student) {
      setMessage("Student email/password match nahi hua.");
      return;
    }
    setActiveStudentId(student.studentId);
    setView("student");
    setMessage("");
  }

  async function submitAdminLogin(formData: FormData) {
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    if (auth) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch {
        setMessage("Firebase admin login failed. Email/password check karo.");
        return;
      }
    }
    if (email === adminEmail && (!auth ? password === adminPassword : true)) {
      setView("admin");
      setMessage("");
      return;
    }
    setMessage("Admin email/password galat hai.");
  }

  async function submitMagneetozLogin(formData: FormData) {
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    if (auth) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch {
        setMessage("Firebase Magneetoz login failed. Email/password check karo.");
        return;
      }
    }
    if (email === magneetozEmail && (!auth ? password === magneetozPassword : true)) {
      setView("magneetoz");
      setMessage("");
      return;
    }
    setMessage("Magneetoz login details galat hain.");
  }

  const shellClass = dark ? "min-h-screen bg-zinc-950 text-white" : "min-h-screen";

  return (
    <main className={shellClass}>
      <Header view={view} setView={setView} dark={dark} setDark={setDark} pgName={store.settings.pgName} />
      {message && <div className="mx-5 mt-4 rounded-lg bg-amber-100 px-4 py-3 font-bold text-amber-950 lg:mx-14">{message}</div>}
      {store.settings.magneetoz.enabled && <MagneetozBanner settings={store.settings} />}
      {view === "public" && <PublicSite store={store} />}
      {view === "adminLogin" && <Login title="Admin Login" hint="Use your admin email and password." onSubmit={submitAdminLogin} />}
      {view === "studentLogin" && <Login title="Student Login" hint="Use the email and password created by admin." onSubmit={submitStudentLogin} />}
      {view === "magneetozLogin" && <Login title="Magneetoz Login" hint="Use Magneetoz owner login." onSubmit={submitMagneetozLogin} />}
      {view === "admin" && (
        <AdminDashboard
          store={store}
          stats={stats}
          patchStore={patchStore}
          addStudent={addStudent}
          addPayment={addPayment}
          selectedStudentId={selectedStudentId}
          setSelectedStudentId={setSelectedStudentId}
          studentQuery={studentQuery}
          setStudentQuery={setStudentQuery}
          feeFilter={feeFilter}
          setFeeFilter={setFeeFilter}
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
      {view === "magneetoz" && <MagneetozManager store={store} patchStore={patchStore} />}
    </main>
  );
}

function Header({ view, setView, dark, setDark, pgName }: { view: View; setView: (view: View) => void; dark: boolean; setDark: (value: boolean) => void; pgName: string }) {
  const [open, setOpen] = useState(false);
  const go = (next: View) => {
    setView(next);
    setOpen(false);
  };
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/90 px-4 py-3 text-zinc-950 backdrop-blur-xl lg:px-14">
      <div className="flex items-center justify-between gap-3">
      <button className="flex items-center gap-3" onClick={() => go("public")}>
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-zinc-950 font-black text-amber-200">AP</span>
        <span className="text-left">
          <strong className="block text-lg">{pgName}</strong>
          <small className="text-zinc-500">Boys Hostel Management</small>
        </span>
      </button>
      <nav className="hidden gap-6 font-bold lg:flex">
        {["About", "Rooms", "Gallery", "Facilities", "Food Timetable", "Notices", "Contact"].map((item) => (
          <a key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`}>{item}</a>
        ))}
      </nav>
      <div className="hidden gap-2 lg:flex">
        <button className="btn btn-light" onClick={() => setDark(!dark)} aria-label="Toggle dark mode"><Moon size={18} /></button>
        {view === "admin" || view === "student" || view === "magneetoz" ? (
          <button className="btn btn-dark" onClick={() => go("public")}><LogOut size={17} /> Logout</button>
        ) : (
          <>
            <button className="btn btn-light" onClick={() => go("studentLogin")}>Student Login</button>
            <button className="btn btn-light" onClick={() => go("magneetozLogin")}>Magneetoz</button>
            <button className="btn btn-dark" onClick={() => go("adminLogin")}>Admin Login</button>
          </>
        )}
      </div>
      <button className="btn btn-light lg:hidden" onClick={() => setOpen(!open)} aria-label="Open menu"><Menu size={18} /></button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 rounded-lg border border-black/10 bg-white p-3 lg:hidden">
          <button className="btn btn-light justify-start" onClick={() => setDark(!dark)}><Moon size={18} /> Dark Mode</button>
          {view === "admin" || view === "student" || view === "magneetoz" ? (
            <button className="btn btn-dark justify-start" onClick={() => go("public")}><LogOut size={17} /> Logout</button>
          ) : (
            <>
              <button className="btn btn-light justify-start" onClick={() => go("studentLogin")}>Student Login</button>
              <button className="btn btn-light justify-start" onClick={() => go("magneetozLogin")}>Magneetoz</button>
              <button className="btn btn-dark justify-start" onClick={() => go("adminLogin")}>Admin Login</button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

function Login({ title, hint, onSubmit }: { title: string; hint: string; onSubmit: (formData: FormData) => void | Promise<void> }) {
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
    <section className="section py-7">
      <a href="https://magneetoz.com" target="_blank" rel="noreferrer" className="group relative block min-h-[430px] overflow-hidden rounded-lg bg-zinc-950 text-white shadow-2xl sm:min-h-[520px] lg:min-h-[68vh]">
        <img src={settings.magneetoz.bannerUrl} alt="Magneetoz promotional offer" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/58 to-black/10" />
        <div className="relative flex min-h-[430px] max-w-4xl flex-col justify-center p-5 sm:min-h-[520px] lg:min-h-[68vh] lg:p-16">
          <p className="eyebrow">Exclusive Restaurant Promotion</p>
          <h2 className="mt-3 text-4xl font-black leading-none sm:text-5xl lg:text-8xl">{settings.magneetoz.restaurantName}</h2>
          <p className="mt-5 max-w-2xl text-xl font-black text-amber-200 lg:mt-7 lg:text-2xl">{settings.magneetoz.title}</p>
          <p className="mt-4 max-w-2xl text-base leading-7 text-white/80 lg:text-lg lg:leading-8">{settings.magneetoz.description}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-amber-200/50 bg-amber-200 px-4 py-3 text-base font-black text-zinc-950 shadow-xl lg:px-5 lg:py-4 lg:text-lg">{settings.magneetoz.couponText}</span>
            <span className="btn bg-white text-zinc-950">{settings.magneetoz.buttonText}</span>
          </div>
          <p className="mt-5 text-sm font-bold uppercase text-white/70">Click anywhere on this offer to visit magneetoz.com</p>
        </div>
      </a>
    </section>
  );
}

function PublicSite({ store }: { store: Store }) {
  return (
    <>
      <section className="relative min-h-[560px] overflow-hidden lg:min-h-[78vh]">
        <img src={store.settings.heroBanner} alt="Premium PG room" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
        <div className="relative max-w-4xl px-6 py-20 text-white lg:px-20 lg:py-36">
          <p className="eyebrow">Luxury Hotel Style PG</p>
          <h1 className="text-5xl font-black leading-none lg:text-8xl">{store.settings.pgName}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/86 lg:text-lg lg:leading-8">{store.settings.about}</p>
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
        <TodayMeal settings={store.settings} />
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

function AdminDashboard({ store, stats, patchStore, addStudent, addPayment, selectedStudentId, setSelectedStudentId, studentQuery, setStudentQuery, feeFilter, setFeeFilter }: {
  store: Store;
  stats: { occupied: number; vacant: number; collection: number; pending: number; complaintsPending: number; complaintsResolved: number };
  patchStore: (patch: Partial<Store>) => void;
  addStudent: (formData: FormData) => void;
  addPayment: (studentId: string, amount: number, mode?: Payment["mode"]) => void;
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  studentQuery: string;
  setStudentQuery: (query: string) => void;
  feeFilter: "all" | "paid" | "pending";
  setFeeFilter: (filter: "all" | "paid" | "pending") => void;
}) {
  const filteredStudents = store.students.filter((student) => {
    const query = studentQuery.trim().toLowerCase();
    const matchesQuery = !query || student.fullName.toLowerCase().includes(query) || student.studentId.toLowerCase().includes(query);
    const matchesFilter = feeFilter === "all" || (feeFilter === "paid" ? balance(student) === 0 : balance(student) > 0);
    return matchesQuery && matchesFilter;
  });
  const selectedStudent = store.students.find((student) => student.studentId === selectedStudentId) || filteredStudents[0];
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
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-emerald-50 p-4"><strong className="block text-2xl">{store.students.filter((student) => balance(student) === 0).length}</strong><span className="text-sm text-emerald-800">Students fully paid</span></div>
            <div className="rounded-lg bg-rose-50 p-4"><strong className="block text-2xl">{store.students.filter((student) => balance(student) > 0).length}</strong><span className="text-sm text-rose-800">Students pending</span></div>
            <div className="rounded-lg bg-amber-50 p-4"><strong className="block text-2xl">{money(store.students.reduce((sum, student) => sum + balance(student), 0))}</strong><span className="text-sm text-amber-800">Total pending</span></div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input className="field" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search by student name or ID" />
            <div className="flex gap-2">
              {(["all", "paid", "pending"] as const).map((filter) => <button key={filter} className={`btn ${feeFilter === filter ? "btn-dark" : "btn-light"}`} onClick={() => setFeeFilter(filter)}>{filter}</button>)}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {filteredStudents.map((student) => (
              <button className="rounded-lg border border-black/10 p-4 text-left transition hover:border-amber-600" key={student.id} onClick={() => setSelectedStudentId(student.studentId)}>
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <strong>{student.fullName}</strong>
                    <p className="text-sm text-zinc-500">{student.studentId} | {student.email} | Room {student.roomNumber}, Bed {student.bedNumber}</p>
                    <p className="text-sm">Paid {money(student.paidAmount)} | Remaining {money(balance(student))} | Due {student.dueDate}</p>
                    <p className={`mt-1 text-sm font-black ${balance(student) === 0 ? "text-emerald-700" : "text-rose-700"}`}>{balance(student) === 0 ? "This month payment done" : `${money(balance(student))} pending`}</p>
                  </div>
                  <span className="btn btn-light">Open Details</span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-zinc-500">
                  {student.paymentHistory.map((payment) => <span key={payment.id}>{payment.date} | {payment.mode} | {money(payment.amount)} | {payment.receiptId}</span>)}
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedStudent && <StudentFeeDetail student={selectedStudent} store={store} patchStore={patchStore} addPayment={addPayment} />}

        <AdminContent store={store} patchStore={patchStore} />
      </div>
    </section>
  );
}

function AdminContent({ store, patchStore }: { store: Store; patchStore: (patch: Partial<Store>) => void }) {
  return (
    <>
      <form className="premium-card grid gap-3 p-5 text-zinc-950" action={(data) => patchStore({ settings: { ...store.settings, pgName: String(data.get("pgName") || store.settings.pgName), about: String(data.get("about") || store.settings.about), heroBanner: String(data.get("heroBanner") || store.settings.heroBanner), contactNumber: String(data.get("contactNumber") || store.settings.contactNumber), address: String(data.get("address") || store.settings.address) } })}>
        <h2 className="text-2xl font-black">Website Settings</h2>
        <input name="pgName" className="field" placeholder="PG Name" />
        <textarea name="about" className="field" placeholder="About content" />
        <input name="heroBanner" className="field" placeholder="Hero banner URL" />
        <input name="contactNumber" className="field" placeholder="Contact number" />
        <input name="address" className="field" placeholder="Address" />
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

      <FoodTimetableManager store={store} patchStore={patchStore} />
    </>
  );
}

function StudentFeeDetail({ student, store, patchStore, addPayment }: { student: Student; store: Store; patchStore: (patch: Partial<Store>) => void; addPayment: (studentId: string, amount: number, mode?: Payment["mode"]) => void }) {
  return (
    <div className="premium-card p-5 text-zinc-950 lg:col-span-3">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="eyebrow">Student Detail</p>
          <h2 className="text-3xl font-black">{student.fullName}</h2>
          <div className="mt-4 grid gap-2 text-sm">
            <p><strong>Identity ID:</strong> {student.studentId}</p>
            <p><strong>Father:</strong> {student.fatherName}</p>
            <p><strong>Phone:</strong> {student.phone}</p>
            <p><strong>Email:</strong> {student.email}</p>
            <p><strong>Room/Bed:</strong> {student.roomNumber} / {student.bedNumber}</p>
            <p><strong>Type:</strong> {student.roomType} | {student.accommodationType}</p>
            <p><strong>Total:</strong> {money(student.rentAmount + student.securityAmount)}</p>
            <p><strong>Paid:</strong> {money(student.paidAmount)}</p>
            <p><strong>Pending:</strong> {money(balance(student))}</p>
          </div>
        </div>
        <div className="grid gap-4">
          <form className="grid gap-3 rounded-lg border border-black/10 p-4" action={(data) => addPayment(student.studentId, Number(data.get("amount")), data.get("mode") as Payment["mode"])}>
            <h3 className="text-xl font-black">Offline Cash / UPI Collection</h3>
            <input className="field" name="amount" type="number" max={balance(student)} placeholder={`Pending ${money(balance(student))}`} required />
            <select className="field" name="mode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Razorpay</option></select>
            <button className="btn btn-dark">Update Payment</button>
          </form>
          <form className="grid gap-3 rounded-lg border border-black/10 p-4" action={(data) => {
            const alert = String(data.get("alert"));
            patchStore({ students: store.students.map((item) => item.studentId === student.studentId ? { ...item, alerts: [alert, ...(item.alerts || [])] } : item) });
          }}>
            <h3 className="text-xl font-black">Send Fee Alert / Notice</h3>
            <textarea className="field" name="alert" defaultValue={`Please complete your pending fee: ${money(balance(student))}.`} />
            <button className="btn btn-dark">Send Alert</button>
          </form>
        </div>
      </div>
      <div className="mt-5">
        <h3 className="text-xl font-black">Payment Timeline</h3>
        <div className="mt-3 grid gap-2">
          {student.paymentHistory.length ? student.paymentHistory.map((payment) => <div key={payment.id} className="rounded-lg border border-black/10 p-3"><strong>{money(payment.amount)}</strong><p className="text-sm text-zinc-500">{payment.date} | {payment.mode} | {payment.receiptId}</p></div>) : <p className="text-zinc-500">No payment recorded yet.</p>}
        </div>
      </div>
    </div>
  );
}

function MagneetozManager({ store, patchStore }: { store: Store; patchStore: (patch: Partial<Store>) => void }) {
  return (
    <section className="section">
      <p className="eyebrow">Magneetoz Control</p>
      <h1 className="mt-2 text-5xl font-black">Offer Manager</h1>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form className="premium-card grid gap-3 p-5 text-zinc-950" action={(data) => patchStore({ settings: { ...store.settings, magneetoz: { enabled: data.get("enabled") === "on", restaurantName: String(data.get("restaurantName") || store.settings.magneetoz.restaurantName), title: String(data.get("title") || store.settings.magneetoz.title), description: String(data.get("description") || store.settings.magneetoz.description), couponText: String(data.get("couponText") || store.settings.magneetoz.couponText), buttonText: String(data.get("buttonText") || store.settings.magneetoz.buttonText), bannerUrl: String(data.get("bannerUrl") || store.settings.magneetoz.bannerUrl) } } })}>
          <h2 className="text-2xl font-black">Create / Edit Offer</h2>
          <label className="flex gap-2 font-bold"><input name="enabled" type="checkbox" defaultChecked={store.settings.magneetoz.enabled} /> Show offer on website</label>
          <input name="restaurantName" className="field" defaultValue={store.settings.magneetoz.restaurantName} placeholder="Restaurant name" />
          <input name="title" className="field" defaultValue={store.settings.magneetoz.title} placeholder="Offer headline" />
          <textarea name="description" className="field" defaultValue={store.settings.magneetoz.description} placeholder="Offer description" />
          <input name="couponText" className="field" defaultValue={store.settings.magneetoz.couponText} placeholder="Coupon text" />
          <input name="buttonText" className="field" defaultValue={store.settings.magneetoz.buttonText} placeholder="Button text" />
          <input name="bannerUrl" className="field" defaultValue={store.settings.magneetoz.bannerUrl} placeholder="Large offer image URL" />
          <button className="btn btn-dark">Save Offer</button>
        </form>
        <div>
          <MagneetozBanner settings={store.settings} />
        </div>
      </div>
    </section>
  );
}

function FoodTimetableManager({ store, patchStore }: { store: Store; patchStore: (patch: Partial<Store>) => void }) {
  return (
    <form className="premium-card grid gap-3 p-5 text-zinc-950 lg:col-span-3" action={(data) => {
      const foodTimetable = { ...store.settings.foodTimetable };
      days.forEach((day) => {
        foodTimetable[day] = {
          breakfast: String(data.get(`${day}-breakfast`) || foodTimetable[day].breakfast),
          lunch: String(data.get(`${day}-lunch`) || foodTimetable[day].lunch),
          dinner: String(data.get(`${day}-dinner`) || foodTimetable[day].dinner)
        };
      });
      patchStore({ settings: { ...store.settings, foodTimetable } });
    }}>
      <div>
        <p className="eyebrow">Food Time Table</p>
        <h2 className="text-2xl font-black">Manage Day-wise Meals</h2>
      </div>
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => (
          <div key={day} className="rounded-lg border border-black/10 p-3">
            <strong>{day}</strong>
            <input className="field mt-3" name={`${day}-breakfast`} defaultValue={store.settings.foodTimetable[day].breakfast} placeholder="Breakfast" />
            <input className="field mt-2" name={`${day}-lunch`} defaultValue={store.settings.foodTimetable[day].lunch} placeholder="Lunch" />
            <input className="field mt-2" name={`${day}-dinner`} defaultValue={store.settings.foodTimetable[day].dinner} placeholder="Dinner" />
          </div>
        ))}
      </div>
      <button className="btn btn-dark">Update Food Timetable</button>
    </form>
  );
}

function StudentDashboard({ store, student, patchStore, payOnline }: { store: Store; student: Student; patchStore: (patch: Partial<Store>) => void; payOnline: (student: Student) => void }) {
  const myComplaints = store.complaints.filter((item) => item.studentId === student.studentId);
  const fullyPaid = store.students.filter((item) => balance(item) === 0).length;
  const pendingStudents = store.students.filter((item) => balance(item) > 0).length;
  return (
    <section className="section">
      <p className="eyebrow">Student Dashboard</p>
      <h1 className="mt-2 text-5xl font-black">Welcome, {student.fullName}</h1>
      <div className="premium-card mt-6 overflow-hidden text-zinc-950">
        <div className="bg-zinc-950 p-5 text-white">
          <p className="eyebrow">Digital Identity Card</p>
          <h2 className="text-3xl font-black">{store.settings.pgName}</h2>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-[120px_1fr]">
          <div className="grid h-28 w-28 place-items-center rounded-lg bg-amber-200 text-4xl font-black text-zinc-950">{student.fullName.slice(0, 2).toUpperCase()}</div>
          <div className="grid gap-1">
            <strong className="text-2xl">{student.fullName}</strong>
            <span>Unique ID: <strong>{student.studentId}</strong></span>
            <span>Room {student.roomNumber} | Bed {student.bedNumber}</span>
            <span>{student.roomType} | {student.accommodationType}</span>
            <span className={balance(student) === 0 ? "font-black text-emerald-700" : "font-black text-rose-700"}>{balance(student) === 0 ? "Payment Clear" : `${money(balance(student))} Pending`}</span>
          </div>
        </div>
      </div>
      {(student.alerts || []).length > 0 && <div className="premium-card mt-6 p-5 text-zinc-950"><h2 className="text-2xl font-black">Admin Alerts</h2>{student.alerts?.map((alert, index) => <p key={`${alert}-${index}`} className="mt-3 rounded-lg bg-amber-50 p-3 font-bold text-amber-950">{alert}</p>)}</div>}
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Profile</h2><p className="mt-3 text-zinc-600">{student.studentId} | Room {student.roomNumber}, Bed {student.bedNumber}</p><p>{student.roomType} | {student.accommodationType}</p></div>
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Fees</h2><p>Total: {money(student.rentAmount + student.securityAmount)}</p><p>Paid: {money(student.paidAmount)}</p><p>Remaining: {money(balance(student))}</p><button className="btn btn-dark mt-4" onClick={() => payOnline(student)}>Pay Online</button></div>
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Emergency</h2><p>{store.settings.contactNumber}</p><p>WhatsApp: {store.settings.whatsappNumber}</p></div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{fullyPaid}</strong><span className="text-zinc-500">Students payment done</span></div>
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{pendingStudents}</strong><span className="text-zinc-500">Students payment pending</span></div>
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{balance(student) === 0 ? "Done" : "Pending"}</strong><span className="text-zinc-500">Your monthly status</span></div>
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
      <TodayMeal settings={store.settings} />
      <div className="mt-6 grid gap-3 lg:grid-cols-7">{days.map((day) => <MealCard key={day} day={day} settings={store.settings} />)}</div>
      <div className="premium-card mt-6 p-5 text-zinc-950">
        <h2 className="text-2xl font-black">Payment History</h2>
        {student.paymentHistory.length ? student.paymentHistory.map((payment) => <div key={payment.id} className="mt-3 rounded-lg border border-black/10 p-3"><strong>{money(payment.amount)}</strong><p className="text-sm text-zinc-500">{payment.date} | {payment.mode} | {payment.receiptId}</p></div>) : <p className="mt-3 text-zinc-500">No payment recorded yet.</p>}
      </div>
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

function TodayMeal({ settings }: { settings: SiteSettings }) {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const meal = settings.foodTimetable[today] || settings.foodTimetable.Monday;
  return (
    <div className="premium-card mt-6 grid gap-4 p-5 text-zinc-950 lg:grid-cols-[180px_1fr_1fr_1fr]">
      <div><p className="eyebrow">Today</p><strong className="text-3xl">{today}</strong></div>
      <div><span className="text-zinc-500">Breakfast</span><strong className="block">{meal.breakfast}</strong></div>
      <div><span className="text-zinc-500">Lunch</span><strong className="block">{meal.lunch}</strong></div>
      <div><span className="text-zinc-500">Dinner</span><strong className="block">{meal.dinner}</strong></div>
    </div>
  );
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

function normalizeStore(saved: Partial<Store>): Store {
  const savedSettings = saved.settings || {};
  const migratedPgName = savedSettings.pgName === "Imperial PG" ? seedStore.settings.pgName : savedSettings.pgName;
  return {
    settings: {
      ...seedStore.settings,
      ...savedSettings,
      pgName: migratedPgName || seedStore.settings.pgName,
      magneetoz: {
        ...seedStore.settings.magneetoz,
        ...(savedSettings.magneetoz || {})
      },
      foodTimetable: {
        ...seedStore.settings.foodTimetable,
        ...(savedSettings.foodTimetable || {})
      }
    },
    students: saved.students || seedStore.students,
    notices: saved.notices || seedStore.notices,
    complaints: saved.complaints || seedStore.complaints,
    rooms: saved.rooms || seedStore.rooms
  };
}
