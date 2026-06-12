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
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { complaints as seedComplaints, notices as seedNotices, rooms as seedRooms, settings as seedSettings, students as seedStudents } from "@/lib/mock-data";
import { auth } from "@/lib/firebase";
import { getCentralMagneetoz, listenCentralMagneetoz, listenMagneetozEvents, saveCentralMagneetoz, trackCentralMagneetozEvent } from "@/lib/magneetoz-central";
import { listenPgSiteStore, savePgSiteStore } from "@/lib/pg-site-sync";
import type { AuditLog, BudgetEntry, Complaint, ConnectedPgSite, ExpenseEntry, MagneetozReferralEvent, Notice, Payment, PaymentMode, RecurringExpense, RevenueEntry, Room, SiteSettings, Student } from "@/lib/types";

type View = "public" | "adminLogin" | "studentLogin" | "magneetozLogin" | "admin" | "student" | "magneetoz";
type Store = {
  settings: SiteSettings;
  students: Student[];
  notices: Notice[];
  complaints: Complaint[];
  rooms: Room[];
  magneetozEvents: MagneetozReferralEvent[];
  connectedPgSites: ConnectedPgSite[];
  revenues: RevenueEntry[];
  expenses: ExpenseEntry[];
  budgets: BudgetEntry[];
  recurringExpenses: RecurringExpense[];
  auditLogs: AuditLog[];
};

const seedStore: Store = {
  settings: seedSettings,
  students: seedStudents,
  notices: seedNotices,
  complaints: seedComplaints,
  rooms: seedRooms,
  magneetozEvents: [],
  connectedPgSites: [{ id: "ap-boys-hostel", name: seedSettings.pgName, sourceId: "APBOYS" }],
  revenues: [],
  expenses: [],
  budgets: [],
  recurringExpenses: [],
  auditLogs: []
};

const days = Object.keys(seedSettings.foodTimetable);
const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@pg.com";
const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
const magneetozEmail = process.env.NEXT_PUBLIC_MAGNEETOZ_EMAIL || "magneetoz73@gmail.com";
const magneetozPassword = process.env.NEXT_PUBLIC_MAGNEETOZ_PASSWORD || "LURlum8423@";
const pgSourceId = process.env.NEXT_PUBLIC_PG_SOURCE_ID || "APBOYS";
const revenueCategories = ["Room Rent Collection", "Security Deposit Collection", "Late Payment Charges", "Food/Mess Charges", "Laundry Charges", "Parking Charges", "Electricity Charges", "Miscellaneous Income", "Other Custom Income Sources"];
const expenseCategories = ["Electricity Bill", "Water Bill", "Internet/WiFi", "Staff Salary", "Maintenance", "Cleaning", "Security Guard", "Food/Mess Expenses", "Laundry Expenses", "Gas Cylinder", "Furniture Purchase", "Appliance Purchase", "Repairs", "Marketing", "Transportation", "Rent", "Taxes", "Other Expenses"];

export default function Home() {
  const [store, setStore] = useState<Store>(seedStore);
  const [view, setView] = useState<View>("public");
  const [activeStudentId, setActiveStudentId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [studentQuery, setStudentQuery] = useState("");
  const [feeFilter, setFeeFilter] = useState<"all" | "paid" | "pending" | "left">("all");
  const [dark, setDark] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const saved = window.localStorage.getItem("premiumPgStore");
    if (saved) setStore(normalizeStore(JSON.parse(saved)));
    const params = new URLSearchParams(window.location.search);
    if (params.get("magneetoz") === "owner") setView("magneetozLogin");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("premiumPgStore", JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    const unsubscribe = listenPgSiteStore<Store>(pgSourceId, (remoteStore) => {
      setStore((current) => normalizeStore({
        ...current,
        ...remoteStore,
        settings: {
          ...current.settings,
          ...remoteStore.settings,
          magneetoz: current.settings.magneetoz
        }
      }));
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const applyCentralMagneetoz = (magneetoz: SiteSettings["magneetoz"]) => {
      setStore((current) => ({ ...current, settings: { ...current.settings, magneetoz: { ...current.settings.magneetoz, ...magneetoz } } }));
    };
    const refreshCentralMagneetoz = async () => {
      const magneetoz = await getCentralMagneetoz();
      if (magneetoz) applyCentralMagneetoz(magneetoz);
    };
    const unsubscribeContent = listenCentralMagneetoz((magneetoz) => {
      applyCentralMagneetoz(magneetoz);
    });
    void refreshCentralMagneetoz();
    const interval = window.setInterval(refreshCentralMagneetoz, 30000);
    const onVisibility = () => {
      if (!document.hidden) void refreshCentralMagneetoz();
    };
    window.addEventListener("focus", refreshCentralMagneetoz);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshCentralMagneetoz);
      document.removeEventListener("visibilitychange", onVisibility);
      unsubscribeContent();
    };
  }, []);

  useEffect(() => {
    if (view !== "magneetoz") return;
    const unsubscribeEvents = listenMagneetozEvents((events) => {
      setStore((current) => ({ ...current, magneetozEvents: events }));
    });
    return () => {
      unsubscribeEvents();
    };
  }, [view]);

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
    setStore((current) => {
      const next = normalizeStore({ ...current, ...patch });
      void savePgSiteStore(pgSourceId, serializePgStore(next)).catch(() => {
        window.alert("Admin update cloud sync nahi ho paaya. Firestore rules/env check karo.");
      });
      return next;
    });
  }

  function uploadLogo(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      patchStore({ settings: { ...store.settings, logoUrl: String(reader.result) } });
    };
    reader.readAsDataURL(file);
  }

  function trackMagneetozClick() {
    const referralCode = store.settings.magneetoz.referralEnabled ? `${store.settings.magneetoz.referralCodePrefix}-${pgSourceId}` : pgSourceId;
    const event: MagneetozReferralEvent = {
      id: crypto.randomUUID(),
      pgSourceId,
      pgName: store.settings.pgName,
      referralCode,
      eventType: "click",
      createdAt: new Date().toISOString()
    };
    setStore((current) => ({ ...current, magneetozEvents: [event, ...current.magneetozEvents] }));
    const { id: _id, ...centralEvent } = event;
    void trackCentralMagneetozEvent(centralEvent);
  }

  async function addStudent(formData: FormData) {
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
      dueDate: nextBillingDate(String(formData.get("joiningDate"))),
      paymentHistory: [],
      status: "Active"
    };
    const rooms = store.rooms.map((room) =>
      room.roomNumber === student.roomNumber ? { ...room, occupiedBeds: Math.min(room.totalBeds, room.occupiedBeds + 1) } : room
    );
    let loginCreated = false;
    try {
      const response = await fetch("/api/admin/create-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: student.email, password: student.password, displayName: student.fullName, student })
      });
      if (!response.ok) {
        const result = await response.json();
        setMessage(result.error || "Firebase student login create nahi ho paya. Env setup check karo.");
      } else {
        const result = await response.json();
        student.id = result.uid || student.id;
        loginCreated = true;
      }
    } catch {
      setMessage("Student local add ho gaya, lekin Firebase Auth create nahi hua. Firebase Admin env setup karo.");
    }
    const initialRevenueEntries = student.paidAmount > 0 ? createInitialStudentRevenue(student) : [];
    const initialAuditLogs = initialRevenueEntries.map((entry) => createAudit("revenue", entry.id, "added", `Initial admission revenue created for ${student.fullName}`));
    patchStore({ students: [student, ...store.students], rooms, revenues: [...initialRevenueEntries, ...store.revenues], auditLogs: [...initialAuditLogs, ...store.auditLogs] });
    if (loginCreated) {
      setMessage(`Admission added. Student can login with ${student.email} / ${student.password}`);
    }
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
    const revenue = createRevenueEntry({
      propertyId: pgSourceId,
      category: "Room Rent Collection",
      amount: payableAmount,
      paymentMode: mode === "Bank" ? "Bank Transfer" : mode,
      receiptNumber: payment.receiptId,
      tenantId: target?.studentId,
      tenantName: target?.fullName,
      notes: `Auto revenue from ${target?.fullName || studentId} fee payment`
    });
    const audit = createAudit("revenue", revenue.id, "added", `Auto revenue created for fee payment ${payment.receiptId}`);
    patchStore({
      students: store.students.map((student) =>
        student.studentId === studentId
          ? { ...student, paidAmount: student.paidAmount + payableAmount, paymentHistory: [payment, ...student.paymentHistory] }
          : student
      ),
      revenues: [revenue, ...store.revenues],
      auditLogs: [audit, ...store.auditLogs]
    });
  }

  function addRevenue(formData: FormData) {
    const revenue = createRevenueEntry({
      propertyId: pgSourceId,
      category: String(formData.get("category")),
      amount: Number(formData.get("amount")),
      paymentMode: formData.get("paymentMode") as PaymentMode,
      receiptNumber: String(formData.get("receiptNumber") || `REV-${Date.now()}`),
      tenantId: String(formData.get("tenantId") || ""),
      tenantName: String(formData.get("tenantName") || ""),
      notes: String(formData.get("notes") || ""),
      proofUrl: String(formData.get("proofUrl") || "")
    });
    patchStore({ revenues: [revenue, ...store.revenues], auditLogs: [createAudit("revenue", revenue.id, "added", `Revenue added: ${revenue.category}`), ...store.auditLogs] });
  }

  function addExpense(formData: FormData) {
    const expense = createExpenseEntry({
      propertyId: pgSourceId,
      category: String(formData.get("category")),
      amount: Number(formData.get("amount")),
      paymentMode: formData.get("paymentMode") as PaymentMode,
      vendorName: String(formData.get("vendorName") || ""),
      invoiceNumber: String(formData.get("invoiceNumber") || `EXP-${Date.now()}`),
      expenseDate: String(formData.get("expenseDate") || todayIso()),
      notes: String(formData.get("notes") || ""),
      proofUrl: String(formData.get("proofUrl") || "")
    });
    patchStore({ expenses: [expense, ...store.expenses], auditLogs: [createAudit("expense", expense.id, "added", `Expense added: ${expense.category}`), ...store.auditLogs] });
  }

  function softDeleteFinance(type: "revenue" | "expense", id: string) {
    if (type === "revenue") {
      patchStore({ revenues: store.revenues.map((entry) => entry.id === id ? { ...entry, deleted: true, updatedAt: new Date().toISOString() } : entry), auditLogs: [createAudit("revenue", id, "deleted", "Revenue soft deleted"), ...store.auditLogs] });
      return;
    }
    patchStore({ expenses: store.expenses.map((entry) => entry.id === id ? { ...entry, deleted: true, updatedAt: new Date().toISOString() } : entry), auditLogs: [createAudit("expense", id, "deleted", "Expense soft deleted"), ...store.auditLogs] });
  }

  function deleteStudent(studentId: string) {
    const student = store.students.find((item) => item.studentId === studentId);
    if (!student) return;
    patchStore({
      students: store.students.filter((item) => item.studentId !== studentId),
      rooms: store.rooms.map((room) => room.roomNumber === student.roomNumber && student.status !== "Left" ? { ...room, occupiedBeds: Math.max(0, room.occupiedBeds - 1) } : room)
    });
    setSelectedStudentId("");
    setMessage(`${student.fullName} deleted from student records.`);
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
      <Header view={view} setView={setView} dark={dark} setDark={setDark} settings={store.settings} />
      {message && <div className="mx-5 mt-4 rounded-lg bg-amber-100 px-4 py-3 font-bold text-amber-950 lg:mx-14">{message}</div>}
      {view === "public" && <PublicSite store={store} onTrackMagneetoz={trackMagneetozClick} />}
      {view === "adminLogin" && <Login title="Admin Login" hint="Use your admin email and password." onSubmit={submitAdminLogin} onClose={() => setView("public")} />}
      {view === "studentLogin" && <Login title="Student Login" hint="Use the email and password created by admin." onSubmit={submitStudentLogin} onClose={() => setView("public")} />}
      {view === "magneetozLogin" && <Login title="Magneetoz Login" hint="Use Magneetoz owner login." onSubmit={submitMagneetozLogin} onClose={() => setView("public")} />}
      {view === "admin" && (
        <AdminDashboard
          store={store}
          stats={stats}
          patchStore={patchStore}
          addStudent={addStudent}
          addPayment={addPayment}
          deleteStudent={deleteStudent}
          addRevenue={addRevenue}
          addExpense={addExpense}
          softDeleteFinance={softDeleteFinance}
          uploadLogo={uploadLogo}
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

function Header({ view, setView, dark, setDark, settings }: { view: View; setView: (view: View) => void; dark: boolean; setDark: (value: boolean) => void; settings: SiteSettings }) {
  const [open, setOpen] = useState(false);
  const go = (next: View) => {
    setView(next);
    setOpen(false);
  };
  return (
    <header className="sticky top-0 z-50 border-b border-black/10 bg-white/75 px-4 py-3 text-zinc-950 shadow-[0_14px_40px_rgba(20,20,20,0.06)] backdrop-blur-2xl lg:px-14">
      <div className="flex items-center justify-between gap-3">
      <button className="flex items-center gap-3" onClick={() => go("public")}>
        {settings.logoUrl ? <img src={settings.logoUrl} alt={`${settings.pgName} logo`} className="h-12 w-12 rounded-2xl object-cover shadow-lg" /> : <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-zinc-950 to-amber-950 font-black text-amber-200 shadow-xl">AP</span>}
        <span className="text-left">
          <strong className="block bg-gradient-to-r from-zinc-950 via-amber-800 to-zinc-950 bg-clip-text text-xl font-black tracking-tight text-transparent lg:text-2xl">{settings.pgName}</strong>
          <small className="text-zinc-500">Boys Hostel Management</small>
        </span>
      </button>
      <nav className="hidden items-center gap-1 rounded-2xl border border-black/10 bg-white/60 p-1 font-bold shadow-sm backdrop-blur-xl lg:flex">
        {["About", "Rooms", "Gallery", "Facilities", "Food Timetable", "Notices", "Contact"].map((item) => (
          <a className="rounded-xl px-3 py-2 text-sm text-zinc-700 transition hover:bg-zinc-950 hover:text-white" key={item} href={`#${item.toLowerCase().replaceAll(" ", "-")}`}>{item}</a>
        ))}
      </nav>
      <div className="hidden gap-2 lg:flex">
        <button className="btn btn-light" onClick={() => setDark(!dark)} aria-label="Toggle dark mode"><Moon size={18} /></button>
        {view === "admin" || view === "student" || view === "magneetoz" ? (
          <button className="btn btn-dark" onClick={() => go("public")}><LogOut size={17} /> Logout</button>
        ) : (
          <>
            <button className="btn btn-light" onClick={() => go("studentLogin")}>Student Login</button>
            <button className="btn btn-dark" onClick={() => go("adminLogin")}>Admin Login</button>
          </>
        )}
      </div>
      <button className="btn btn-light lg:hidden" onClick={() => setOpen(!open)} aria-label="Open menu"><Menu size={18} /></button>
      </div>
      {open && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-black/10 bg-white/95 p-3 shadow-2xl backdrop-blur-xl lg:hidden">
          <button className="btn btn-light justify-start" onClick={() => setDark(!dark)}><Moon size={18} /> Dark Mode</button>
          {view === "admin" || view === "student" || view === "magneetoz" ? (
            <button className="btn btn-dark justify-start" onClick={() => go("public")}><LogOut size={17} /> Logout</button>
          ) : (
            <>
              <button className="btn btn-light justify-start" onClick={() => go("studentLogin")}>Student Login</button>
              <button className="btn btn-dark justify-start" onClick={() => go("adminLogin")}>Admin Login</button>
            </>
          )}
        </div>
      )}
    </header>
  );
}

function Login({ title, hint, onSubmit, onClose }: { title: string; hint: string; onSubmit: (formData: FormData) => void | Promise<void>; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/70 p-4 backdrop-blur-xl">
      <form action={onSubmit} className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/50 bg-[#fbf7ef] text-zinc-950 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
        <div className="bg-[radial-gradient(circle_at_10%_0%,rgba(245,189,71,0.35),transparent_30%),linear-gradient(135deg,#111111,#30200f)] p-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-amber-300">Secure Access</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight">{title}</h1>
            </div>
            <button type="button" className="rounded-2xl bg-white/10 px-3 py-2 font-black text-white backdrop-blur-xl transition hover:bg-white hover:text-zinc-950" onClick={onClose}>Close</button>
          </div>
          <p className="mt-3 text-sm leading-6 text-white/72">{hint}</p>
        </div>
        <div className="grid gap-4 p-6">
          <input className="field" name="email" type="email" placeholder="Email" required />
          <input className="field" name="password" type="password" placeholder="Password" required />
          <button className="btn btn-dark">Login</button>
        </div>
      </form>
    </div>
  );
}

function MagneetozBanner({ settings, pgSourceId, onTrack }: { settings: SiteSettings; pgSourceId?: string; onTrack?: () => void }) {
  const [slide, setSlide] = useState(0);
  const source = pgSourceId || "PG";
  const carouselImages = [settings.magneetoz.bannerUrl, ...settings.magneetoz.foodImages].filter(Boolean).slice(0, 4);
  const activeImage = carouselImages[slide % Math.max(carouselImages.length, 1)] || settings.magneetoz.bannerUrl;
  useEffect(() => {
    if (carouselImages.length <= 1) return;
    const interval = window.setInterval(() => setSlide((current) => (current + 1) % carouselImages.length), 3500);
    return () => window.clearInterval(interval);
  }, [carouselImages.length]);
  const manualCoupon = settings.magneetoz.pgCoupons?.[source];
  const referralCode = manualCoupon || (settings.magneetoz.referralEnabled ? `${settings.magneetoz.referralCodePrefix}-${source}` : source);
  const targetLink = `${settings.magneetoz.websiteLink}?source=${encodeURIComponent(pgSourceId || "PG")}&ref=${encodeURIComponent(referralCode)}`;
  return (
    <section className="px-4 py-4 lg:px-14 lg:py-7">
      <a href={targetLink} onClick={onTrack} target="_blank" rel="noreferrer" className="group relative block h-[230px] overflow-hidden rounded-lg bg-zinc-950 text-white shadow-2xl sm:h-[320px] lg:h-auto lg:min-h-[68vh]">
        <img src={activeImage} alt="Magneetoz promotional offer" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/88 via-black/58 to-black/10" />
        <div className="relative flex h-full max-w-4xl flex-col justify-center p-4 lg:min-h-[68vh] lg:p-16">
          <p className="text-[11px] font-black uppercase text-amber-500 lg:text-sm">Exclusive Restaurant Promotion</p>
          <h2 className="mt-2 max-w-[280px] text-2xl font-black leading-none sm:max-w-lg sm:text-4xl lg:max-w-4xl lg:text-8xl">{settings.magneetoz.restaurantName}</h2>
          <p className="mt-3 max-w-[270px] text-base font-black leading-snug text-amber-200 sm:max-w-lg sm:text-xl lg:mt-7 lg:max-w-2xl lg:text-2xl">{settings.magneetoz.title}</p>
          <p className="mt-4 hidden max-w-2xl text-base leading-7 text-white/80 sm:block lg:text-lg lg:leading-8">{settings.magneetoz.description}</p>
          <p className="mt-3 hidden max-w-2xl text-base font-bold text-white lg:block">{settings.magneetoz.discountDetails}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 lg:mt-8 lg:gap-3">
            <span className="rounded-lg border border-amber-200/50 bg-amber-200 px-3 py-2 text-sm font-black text-zinc-950 shadow-xl lg:px-5 lg:py-4 lg:text-lg">{manualCoupon ? `USE COUPON: ${manualCoupon}` : settings.magneetoz.couponText}</span>
            <span className="rounded-lg bg-white px-3 py-2 text-sm font-black text-zinc-950 lg:px-5 lg:py-3 lg:text-base">{settings.magneetoz.buttonText}</span>
          </div>
          <p className="mt-5 hidden text-sm font-bold uppercase text-white/70 lg:block">Click anywhere on this offer to visit magneetoz.com</p>
          {carouselImages.length > 1 && <div className="absolute bottom-4 left-4 flex gap-2 lg:bottom-8 lg:left-16">{carouselImages.map((_, index) => <span key={index} className={`h-2 rounded-full transition-all ${index === slide ? "w-8 bg-amber-300" : "w-2 bg-white/45"}`} />)}</div>}
        </div>
      </a>
    </section>
  );
}

function PublicSite({ store, onTrackMagneetoz }: { store: Store; onTrackMagneetoz: () => void }) {
  return (
    <>
      <section className="relative mx-3 mt-4 h-[50svh] min-h-[360px] overflow-hidden rounded-[28px] lg:mx-8 lg:h-auto lg:min-h-[78vh]">
        <img src={store.settings.heroBanner} alt="Premium PG room" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(0,0,0,0.86),rgba(0,0,0,0.50)_52%,rgba(0,0,0,0.08))]" />
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="relative flex h-full max-w-4xl flex-col justify-center px-6 py-10 text-white lg:block lg:h-auto lg:px-20 lg:py-36">
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-amber-200 backdrop-blur-xl">Luxury Hotel Style PG</p>
          <h1 className="mt-5 text-5xl font-black leading-none tracking-tight lg:text-8xl">{store.settings.pgName}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/86 lg:text-xl lg:leading-9">{store.settings.about}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="btn bg-amber-300 text-zinc-950 shadow-[0_18px_50px_rgba(245,189,71,0.35)]" href="#rooms">Explore Rooms</a>
            <a className="btn border border-white/30 bg-white/10 text-white backdrop-blur-xl" href="#contact">Contact PG</a>
          </div>
        </div>
      </section>
      {store.settings.magneetoz.enabled && <MagneetozBanner settings={store.settings} pgSourceId={pgSourceId} onTrack={onTrackMagneetoz} />}
      <section id="facilities" className="section">
        <p className="eyebrow">Facilities</p>
        <h2 className="mt-2 max-w-3xl text-4xl font-black tracking-tight lg:text-5xl">Comfort, safety, and premium student living in one place.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {store.settings.facilities.map((item) => <div className="premium-card p-6 font-bold text-zinc-950" key={item}><CheckCircle2 className="mb-4 rounded-2xl bg-emerald-50 p-2 text-emerald-700" size={40} />{item}</div>)}
        </div>
      </section>
      <section id="rooms" className="section bg-[radial-gradient(circle_at_10%_0%,rgba(245,189,71,0.18),transparent_28%),linear-gradient(135deg,#101010,#21180d)] text-white">
        <p className="eyebrow">Room Types</p>
        <h2 className="mt-2 text-4xl font-black tracking-tight lg:text-5xl">Rooms, photos, rent, beds and videos.</h2>
        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {store.rooms.map((room) => <RoomCard key={room.id} room={room} />)}
        </div>
      </section>
      <section id="food-timetable" className="section">
        <p className="eyebrow">Food Timetable</p>
        <h2 className="mt-2 text-4xl font-black tracking-tight lg:text-5xl">Weekly breakfast, lunch and dinner.</h2>
        <TodayMeal settings={store.settings} />
        <div className="mt-8 grid gap-3 lg:grid-cols-7">
          {days.map((day) => <MealCard key={day} day={day} settings={store.settings} />)}
        </div>
      </section>
      <section id="notices" className="section bg-white/70 text-zinc-950 backdrop-blur-xl">
        <p className="eyebrow">Notices</p>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">{store.notices.map((notice) => <NoticeCard key={notice.id} notice={notice} />)}</div>
      </section>
      <section id="contact" className="section">
        <div className="premium-card grid gap-6 p-7 text-zinc-950 lg:grid-cols-2 lg:p-10">
          <div>
            <p className="eyebrow">Contact</p>
            <h2 className="mt-2 text-4xl font-black">Visit or call for admission.</h2>
            <p className="mt-4 text-zinc-600">{store.settings.address}</p>
            <p className="mt-2 font-bold">{store.settings.contactNumber}</p>
          </div>
          {isEmbeddableMap(store.settings.googleMapsLink) ? (
            <iframe src={store.settings.googleMapsLink} className="h-72 w-full rounded-[20px] border-0" title="PG location map" />
          ) : (
            <div className="grid h-72 place-items-center rounded-[20px] border border-dashed border-black/15 bg-white/70 p-6 text-center">
              <div>
                <p className="font-black">Google Maps embed link required</p>
                <p className="mt-2 text-sm text-zinc-500">Admin dashboard me Google Maps ka Embed URL add karo.</p>
                {store.settings.googleMapsLink && <a className="btn btn-dark mt-4" href={store.settings.googleMapsLink} target="_blank" rel="noreferrer">Open Location</a>}
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function AdminDashboard({ store, stats, patchStore, addStudent, addPayment, deleteStudent, addRevenue, addExpense, softDeleteFinance, uploadLogo, selectedStudentId, setSelectedStudentId, studentQuery, setStudentQuery, feeFilter, setFeeFilter }: {
  store: Store;
  stats: { occupied: number; vacant: number; collection: number; pending: number; complaintsPending: number; complaintsResolved: number };
  patchStore: (patch: Partial<Store>) => void;
  addStudent: (formData: FormData) => void | Promise<void>;
  addPayment: (studentId: string, amount: number, mode?: Payment["mode"]) => void;
  deleteStudent: (studentId: string) => void;
  addRevenue: (formData: FormData) => void;
  addExpense: (formData: FormData) => void;
  softDeleteFinance: (type: "revenue" | "expense", id: string) => void;
  uploadLogo: (file: File) => void;
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  studentQuery: string;
  setStudentQuery: (query: string) => void;
  feeFilter: "all" | "paid" | "pending" | "left";
  setFeeFilter: (filter: "all" | "paid" | "pending" | "left") => void;
}) {
  const filteredStudents = store.students.filter((student) => {
    const query = studentQuery.trim().toLowerCase();
    const matchesQuery = !query || student.fullName.toLowerCase().includes(query) || student.studentId.toLowerCase().includes(query);
    const matchesFilter =
      feeFilter === "all"
        ? student.status !== "Left"
        : feeFilter === "left"
          ? student.status === "Left"
          : feeFilter === "paid"
            ? student.status !== "Left" && balance(student) === 0
            : student.status !== "Left" && balance(student) > 0;
    return matchesQuery && matchesFilter;
  });
  const selectedStudent = store.students.find((student) => student.studentId === selectedStudentId);
  const activeStudents = store.students.filter((student) => student.status !== "Left");
  const statItems: Array<[string, string | number, LucideIcon]> = [
    ["Active Students", activeStudents.length, BedDouble],
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
          {["fullName", "fatherName", "phone", "email", "password", "aadhaar", "address"].map((name) => (
            <input key={name} name={name} className="field" placeholder={labelize(name)} required />
          ))}
          <label className="grid gap-1 text-sm font-bold">Joining Date <input name="joiningDate" type="date" className="field" required /></label>
          {["roomNumber", "bedNumber", "rentAmount", "securityAmount", "paidAmount"].map((name) => (
            <input key={name} name={name} className="field" placeholder={labelize(name)} required />
          ))}
          <select name="roomType" className="field"><option>Single Seater</option><option>Double Seater</option><option>Triple Seater</option></select>
          <select name="accommodationType" className="field"><option>AC</option><option>Non AC</option></select>
          <button className="btn btn-dark">Add Student</button>
        </form>

        <div className="premium-card p-5 text-zinc-950 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black">Students, Fees & Payment History</h2>
            <button className="btn btn-dark" onClick={() => downloadAllStudentsPdf(store)}>Download All PDF</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-2xl bg-emerald-50 p-4 shadow-sm"><strong className="block text-2xl">{store.students.filter((student) => student.status !== "Left" && balance(student) === 0).length}</strong><span className="text-sm text-emerald-800">Students fully paid</span></div>
            <div className="rounded-2xl bg-rose-50 p-4 shadow-sm"><strong className="block text-2xl">{store.students.filter((student) => student.status !== "Left" && balance(student) > 0).length}</strong><span className="text-sm text-rose-800">Students pending</span></div>
            <div className="rounded-2xl bg-zinc-100 p-4 shadow-sm"><strong className="block text-2xl">{store.students.filter((student) => student.status === "Left").length}</strong><span className="text-sm text-zinc-700">Left students</span></div>
            <div className="rounded-2xl bg-amber-50 p-4 shadow-sm"><strong className="block text-2xl">{money(store.students.filter((student) => student.status !== "Left").reduce((sum, student) => sum + balance(student), 0))}</strong><span className="text-sm text-amber-800">Total pending</span></div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input className="field" value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search by student name or ID" />
            <div className="flex gap-2">
              {(["all", "paid", "pending", "left"] as const).map((filter) => <button key={filter} className={`btn ${feeFilter === filter ? "btn-dark" : "btn-light"}`} onClick={() => setFeeFilter(filter)}>{filter === "left" ? "Left Students" : filter}</button>)}
            </div>
          </div>
          <div className="mt-4 grid gap-3">
            {filteredStudents.map((student) => (
              <button className="premium-card p-4 text-left transition hover:border-amber-600" key={student.id} onClick={() => setSelectedStudentId(student.studentId)}>
                <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <strong>{student.fullName}</strong>
                    <p className="text-sm text-zinc-500">{student.studentId} | {student.email} | Room {student.roomNumber}, Bed {student.bedNumber}</p>
                    <p className="text-sm">Paid {money(student.paidAmount)} | Remaining {money(balance(student))} | Due {nextBillingDate(student.joiningDate)}</p>
                    <p className={`mt-1 text-sm font-black ${balance(student) === 0 ? "text-emerald-700" : "text-rose-700"}`}>{balance(student) === 0 ? "This month payment done" : `${money(balance(student))} pending`}</p>
                    {student.status === "Left" && <p className="mt-1 text-sm font-black text-zinc-500">Left on {student.exitDate}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {student.status !== "Left" && balance(student) > 0 && <a className="btn bg-emerald-600 text-white" href={whatsappReminderLink(store.settings.pgName, student)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>WhatsApp</a>}
                    <span className="btn btn-light">Open Details</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-zinc-500">
                  {student.paymentHistory.map((payment) => <span key={payment.id}>{payment.date} | {payment.mode} | {money(payment.amount)} | {payment.receiptId}</span>)}
                </div>
              </button>
            ))}
            {filteredStudents.length === 0 && <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-6 text-center text-zinc-500">No students found in this section.</div>}
          </div>
        </div>

        {selectedStudent && <StudentDetailModal student={selectedStudent} store={store} patchStore={patchStore} addPayment={addPayment} deleteStudent={deleteStudent} onClose={() => setSelectedStudentId("")} />}

        <AdminContent store={store} patchStore={patchStore} uploadLogo={uploadLogo} />
        <FinanceDashboard store={store} addRevenue={addRevenue} addExpense={addExpense} softDeleteFinance={softDeleteFinance} />
      </div>
    </section>
  );
}

function AdminContent({ store, patchStore, uploadLogo }: { store: Store; patchStore: (patch: Partial<Store>) => void; uploadLogo: (file: File) => void }) {
  return (
    <>
      <form className="premium-card grid gap-3 p-5 text-zinc-950" action={(data) => patchStore({ settings: { ...store.settings, pgName: String(data.get("pgName") || store.settings.pgName), logoUrl: String(data.get("logoUrl") || store.settings.logoUrl), about: String(data.get("about") || store.settings.about), heroBanner: String(data.get("heroBanner") || store.settings.heroBanner), contactNumber: String(data.get("contactNumber") || store.settings.contactNumber), address: String(data.get("address") || store.settings.address), googleMapsLink: String(data.get("googleMapsLink") || store.settings.googleMapsLink) } })}>
        <h2 className="text-2xl font-black">Website Settings</h2>
        <input name="pgName" className="field" placeholder="PG Name" />
        <input name="logoUrl" className="field" placeholder="Logo image URL" />
        <label className="grid gap-2 text-sm font-bold">
          Upload Logo Manually
          <input className="field" type="file" accept="image/*" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) uploadLogo(file);
          }} />
        </label>
        {store.settings.logoUrl && <div className="flex items-center gap-3 rounded-2xl bg-white/70 p-3"><img src={store.settings.logoUrl} alt="Current logo" className="h-14 w-14 rounded-2xl object-cover" /><span className="text-sm font-bold text-zinc-600">Current header logo</span></div>}
        <textarea name="about" className="field" placeholder="About content" />
        <input name="heroBanner" className="field" placeholder="Hero banner URL" />
        <input name="contactNumber" className="field" placeholder="Contact number" />
        <input name="address" className="field" placeholder="Address" />
        <input name="googleMapsLink" className="field" placeholder="Google Maps embed URL" />
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

function FinanceDashboard({ store, addRevenue, addExpense, softDeleteFinance }: { store: Store; addRevenue: (formData: FormData) => void; addExpense: (formData: FormData) => void; softDeleteFinance: (type: "revenue" | "expense", id: string) => void }) {
  const revenues = store.revenues.filter((entry) => !entry.deleted);
  const expenses = store.expenses.filter((entry) => !entry.deleted);
  const today = todayIso();
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const revenueToday = sumAmount(revenues.filter((entry) => entry.date === today));
  const expenseToday = sumAmount(expenses.filter((entry) => entry.expenseDate === today));
  const revenueMonth = sumAmount(revenues.filter((entry) => entry.date.startsWith(month)));
  const expenseMonth = sumAmount(expenses.filter((entry) => entry.expenseDate.startsWith(month)));
  const revenueYear = sumAmount(revenues.filter((entry) => entry.date.startsWith(year)));
  const expenseYear = sumAmount(expenses.filter((entry) => entry.expenseDate.startsWith(year)));
  const lifetimeRevenue = sumAmount(revenues);
  const lifetimeExpense = sumAmount(expenses);
  const chartData = buildMonthlyFinanceData(revenues, expenses);
  const categoryData = topCategories(expenses);

  return (
    <section className="lg:col-span-3">
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Finance</p>
          <h2 className="text-4xl font-black tracking-tight">Revenue, Expense & Profit Dashboard</h2>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-light" onClick={() => exportFinanceCsv(revenues, expenses)}>Export CSV</button>
          <button className="btn btn-dark" onClick={() => downloadFinancePdf(store)}>P&L PDF</button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceCard label="Revenue Today" value={money(revenueToday)} tone="emerald" />
        <FinanceCard label="Expense Today" value={money(expenseToday)} tone="rose" />
        <FinanceCard label="Net Today" value={money(revenueToday - expenseToday)} tone="amber" />
        <FinanceCard label="Closing Balance" value={money(lifetimeRevenue - lifetimeExpense)} tone="zinc" />
        <FinanceCard label="Revenue This Month" value={money(revenueMonth)} tone="emerald" />
        <FinanceCard label="Expense This Month" value={money(expenseMonth)} tone="rose" />
        <FinanceCard label="Profit This Month" value={money(revenueMonth - expenseMonth)} tone="amber" />
        <FinanceCard label="Lifetime Profit" value={money(lifetimeRevenue - lifetimeExpense)} tone="zinc" />
        <FinanceCard label="Revenue This Year" value={money(revenueYear)} tone="emerald" />
        <FinanceCard label="Expense This Year" value={money(expenseYear)} tone="rose" />
        <FinanceCard label="Profit This Year" value={money(revenueYear - expenseYear)} tone="amber" />
        <FinanceCard label="Profit %" value={`${percent(lifetimeRevenue - lifetimeExpense, lifetimeRevenue)}%`} tone="zinc" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="premium-card p-5">
          <h3 className="text-xl font-black">Monthly Revenue / Expense / Profit</h3>
          <div className="mt-4 min-h-[288px] min-w-0" style={{ width: "100%", height: 288 }}>
            <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line dataKey="revenue" stroke="#059669" strokeWidth={3} />
                <Line dataKey="expense" stroke="#e11d48" strokeWidth={3} />
                <Line dataKey="profit" stroke="#b98122" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="premium-card p-5">
          <h3 className="text-xl font-black">Top Expense Categories</h3>
          <div className="mt-4 min-h-[288px] min-w-0" style={{ width: "100%", height: 288 }}>
            <ResponsiveContainer width="100%" height={288} minWidth={0} minHeight={240}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eadfce" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="amount" fill="#b98122" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <FinanceEntryForm title="Add Revenue Entry" type="revenue" onSubmit={addRevenue} />
        <FinanceEntryForm title="Add Expense Entry" type="expense" onSubmit={addExpense} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <FinanceTable title="Revenue Entries" type="revenue" rows={revenues.slice(0, 10)} onDelete={softDeleteFinance} />
        <FinanceTable title="Expense Entries" type="expense" rows={expenses.slice(0, 10)} onDelete={softDeleteFinance} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="premium-card p-5"><h3 className="text-xl font-black">Cash Flow</h3><p className="mt-3">Opening Balance: {money(0)}</p><p>Cash Inflow: {money(lifetimeRevenue)}</p><p>Cash Outflow: {money(lifetimeExpense)}</p><p className="font-black">Closing Balance: {money(lifetimeRevenue - lifetimeExpense)}</p></div>
        <div className="premium-card p-5"><h3 className="text-xl font-black">Budgets</h3><p className="mt-3 text-zinc-600">Monthly and category budgets are stored in the scalable data model. Add values from future budget controls.</p><p className="mt-2 font-black">{store.budgets.length} budget records</p></div>
        <div className="premium-card p-5"><h3 className="text-xl font-black">Audit Logs</h3><div className="mt-3 grid gap-2 text-sm">{store.auditLogs.slice(0, 5).map((log) => <p key={log.id} className="rounded-2xl bg-white/70 p-3">{log.timestamp.slice(0, 10)} | {log.action} | {log.summary}</p>)}</div></div>
      </div>
    </section>
  );
}

function FinanceCard({ label, value, tone }: { label: string; value: string; tone: "emerald" | "rose" | "amber" | "zinc" }) {
  const toneClass = tone === "emerald" ? "text-emerald-700 bg-emerald-50" : tone === "rose" ? "text-rose-700 bg-rose-50" : tone === "amber" ? "text-amber-800 bg-amber-50" : "text-zinc-800 bg-zinc-100";
  return <div className="premium-card p-5"><span className={`rounded-full px-3 py-1 text-xs font-black ${toneClass}`}>{label}</span><strong className="mt-4 block text-2xl">{value}</strong></div>;
}

function FinanceEntryForm({ title, type, onSubmit }: { title: string; type: "revenue" | "expense"; onSubmit: (formData: FormData) => void }) {
  const categories = type === "revenue" ? revenueCategories : expenseCategories;
  return (
    <form className="premium-card grid gap-3 p-5" action={onSubmit}>
      <h3 className="text-xl font-black">{title}</h3>
      <select name="category" className="field">{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <input name="amount" type="number" className="field" placeholder="Amount" required />
      <select name="paymentMode" className="field"><option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Card</option><option>Razorpay</option></select>
      {type === "revenue" ? <><input name="tenantName" className="field" placeholder="Tenant name optional" /><input name="receiptNumber" className="field" placeholder="Receipt number" /></> : <><input name="vendorName" className="field" placeholder="Vendor name" /><input name="invoiceNumber" className="field" placeholder="Invoice number" /><input name="expenseDate" type="date" className="field" /></>}
      <input name="proofUrl" className="field" placeholder="Bill/receipt image or PDF URL" />
      <textarea name="notes" className="field" placeholder="Notes" />
      <button className="btn btn-dark">Save {type}</button>
    </form>
  );
}

function FinanceTable({ title, type, rows, onDelete }: { title: string; type: "revenue" | "expense"; rows: Array<RevenueEntry | ExpenseEntry>; onDelete: (type: "revenue" | "expense", id: string) => void }) {
  return <div className="premium-card p-5"><h3 className="text-xl font-black">{title}</h3><div className="mt-3 grid gap-2">{rows.length ? rows.map((row) => <div key={row.id} className="grid gap-3 rounded-2xl bg-white/70 p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><strong>{row.category}</strong><p className="text-sm text-zinc-500">{type === "revenue" ? (row as RevenueEntry).date : (row as ExpenseEntry).expenseDate} | {row.paymentMode}</p></div><strong>{money(row.amount)}</strong><button className="btn btn-light" onClick={() => onDelete(type, row.id)}>Delete</button></div>) : <p className="text-zinc-500">No entries yet.</p>}</div></div>;
}

function StudentDetailModal({ student, store, patchStore, addPayment, deleteStudent, onClose }: { student: Student; store: Store; patchStore: (patch: Partial<Store>) => void; addPayment: (studentId: string, amount: number, mode?: Payment["mode"]) => void; deleteStudent: (studentId: string) => void; onClose: () => void }) {
  const pending = balance(student);
  const paid = student.paidAmount;
  const due = totalDue(student);
  const credit = advanceCredit(student);
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-zinc-950/70 p-3 backdrop-blur-xl">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-[28px] border border-white/50 bg-[#fbf7ef] text-zinc-950 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_15%_0%,rgba(245,189,71,0.28),transparent_28%),linear-gradient(135deg,#111111,#30200f)] p-6 text-white lg:p-8">
          <div className="absolute right-8 top-8 hidden h-28 w-28 rounded-full border border-white/15 bg-white/10 lg:block" />
          <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-amber-300">Student Command Center</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight lg:text-5xl">{student.fullName}</h2>
            <p className="mt-2 text-white/70">{student.studentId} | Room {student.roomNumber}, Bed {student.bedNumber}</p>
          </div>
          <button className="btn bg-white text-zinc-950" onClick={onClose}>Close</button>
          </div>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[0.85fr_1.15fr] lg:p-7">
        <div className="grid gap-5">
          <div className="premium-card p-5">
            <p className="eyebrow">Identity Card</p>
            <div className="mt-4 flex items-center gap-4">
              <div className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-amber-200 to-amber-500 text-3xl font-black">{student.fullName.slice(0, 2).toUpperCase()}</div>
              <div>
                <h3 className="text-2xl font-black">{student.fullName}</h3>
                <p className="text-sm text-zinc-500">{student.studentId}</p>
                <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${student.status === "Left" ? "bg-zinc-200 text-zinc-700" : "bg-emerald-100 text-emerald-700"}`}>{student.status || "Active"}</span>
              </div>
            </div>
            <div className="mt-5 grid gap-3 text-sm">
              <InfoLine label="Father" value={student.fatherName} />
              <InfoLine label="Phone" value={student.phone} />
              <InfoLine label="Email" value={student.email} />
              <InfoLine label="Room / Bed" value={`${student.roomNumber} / ${student.bedNumber}`} />
              <InfoLine label="Type" value={`${student.roomType} | ${student.accommodationType}`} />
              <InfoLine label="Joining" value={student.joiningDate} />
              {student.exitDate && <InfoLine label="Exit" value={student.exitDate} />}
              <InfoLine label="Next Billing" value={student.status === "Left" ? "Stopped" : nextBillingDate(student.joiningDate)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="premium-card p-4"><span className="text-sm text-zinc-500">Total Due</span><strong className="block text-2xl">{money(due)}</strong></div>
            <div className="premium-card p-4"><span className="text-sm text-zinc-500">Deposited</span><strong className="block text-2xl text-emerald-700">{money(paid)}</strong></div>
            <div className="premium-card p-4"><span className="text-sm text-zinc-500">Pending</span><strong className="block text-2xl text-rose-700">{money(pending)}</strong></div>
            <div className="premium-card p-4"><span className="text-sm text-zinc-500">Advance</span><strong className="block text-2xl text-amber-700">{money(credit)}</strong></div>
          </div>
        </div>
        <div className="grid gap-4">
          <form className="premium-card grid gap-3 p-5" action={(data) => addPayment(student.studentId, Number(data.get("amount")), data.get("mode") as Payment["mode"])}>
            <h3 className="text-xl font-black">Offline Cash / UPI Collection</h3>
            <input className="field" name="amount" type="number" max={balance(student)} placeholder={`Pending ${money(balance(student))}`} required />
            <select className="field" name="mode"><option>Cash</option><option>UPI</option><option>Bank</option><option>Razorpay</option></select>
            <button className="btn btn-dark">Update Payment</button>
          </form>
          <button className="btn btn-dark" onClick={() => downloadStudentPdf(store, student)}>Download Student PDF</button>
          <form className="premium-card grid gap-3 p-5" action={(data) => {
            const alert = String(data.get("alert"));
            patchStore({ students: store.students.map((item) => item.studentId === student.studentId ? { ...item, alerts: [alert, ...(item.alerts || [])] } : item) });
          }}>
            <h3 className="text-xl font-black">Send Fee Alert / Notice</h3>
            <textarea className="field" name="alert" defaultValue={`Please complete your pending fee: ${money(balance(student))}.`} />
            <button className="btn btn-dark">Send Alert</button>
          </form>
          {student.status !== "Left" && (
            <form className="premium-card grid gap-3 p-5" action={(data) => {
              const exitDate = String(data.get("exitDate"));
              patchStore({
                students: store.students.map((item) => item.studentId === student.studentId ? { ...item, status: "Left", exitDate } : item),
                rooms: store.rooms.map((room) => room.roomNumber === student.roomNumber ? { ...room, occupiedBeds: Math.max(0, room.occupiedBeds - 1) } : room)
              });
            }}>
              <h3 className="text-xl font-black">Student Leaving / Checkout</h3>
              <label className="grid gap-1 text-sm font-bold">Exit Date <input className="field" type="date" name="exitDate" required /></label>
              <button className="btn btn-light">Mark Student Left</button>
            </form>
          )}
          <button className="btn border border-rose-200 bg-rose-50 text-rose-700" onClick={() => {
            const first = window.confirm(`Delete ${student.fullName}? This will remove student details from admin list.`);
            if (!first) return;
            const second = window.confirm("Final confirmation: Are you absolutely sure? This action cannot be undone.");
            if (!second) return;
            deleteStudent(student.studentId);
          }}>Delete Student</button>
        </div>
      </div>
      <div className="px-5 pb-6 lg:px-7">
        <div className="premium-card p-5">
          <h3 className="text-xl font-black">Payment Timeline</h3>
          <div className="mt-3 grid gap-2">
            {student.paymentHistory.length ? student.paymentHistory.map((payment) => <div key={payment.id} className="rounded-2xl border border-black/10 bg-white/70 p-3"><strong>{money(payment.amount)}</strong><p className="text-sm text-zinc-500">{payment.date} | {payment.mode} | {payment.receiptId}</p></div>) : <p className="text-zinc-500">No payment recorded yet.</p>}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/70 px-3 py-2"><span className="text-zinc-500">{label}</span><strong className="text-right">{value}</strong></div>;
}

function MagneetozManager({ store, patchStore }: { store: Store; patchStore: (patch: Partial<Store>) => void }) {
  const totalClicks = store.magneetozEvents.filter((event) => event.eventType === "click").length;
  const totalOrders = store.magneetozEvents.filter((event) => event.eventType === "order").length;
  const totalRevenue = store.magneetozEvents.reduce((sum, event) => sum + (event.orderValue || 0), 0);
  const byPg = store.connectedPgSites.map((site) => {
    const events = store.magneetozEvents.filter((event) => event.pgSourceId === site.sourceId);
    return {
      ...site,
      clicks: events.filter((event) => event.eventType === "click").length,
      orders: events.filter((event) => event.eventType === "order").length,
      revenue: events.reduce((sum, event) => sum + (event.orderValue || 0), 0)
    };
  });
  function savePromotion(data: FormData) {
    const magneetoz = {
      enabled: data.get("enabled") === "on",
      restaurantName: String(data.get("restaurantName") || store.settings.magneetoz.restaurantName),
      title: String(data.get("title") || store.settings.magneetoz.title),
      description: String(data.get("description") || store.settings.magneetoz.description),
      discountDetails: String(data.get("discountDetails") || store.settings.magneetoz.discountDetails),
      couponText: String(data.get("couponText") || store.settings.magneetoz.couponText),
      referralCodePrefix: store.settings.magneetoz.referralCodePrefix,
      referralEnabled: true,
      pgCoupons: parsePgCoupons(String(data.get("pgCoupons") || formatPgCoupons(store.settings.magneetoz.pgCoupons))),
      buttonText: String(data.get("buttonText") || store.settings.magneetoz.buttonText),
      bannerUrl: store.settings.magneetoz.bannerUrl,
      foodImages: splitLines(String(data.get("foodImages") || store.settings.magneetoz.foodImages.join("\n"))),
      websiteLink: store.settings.magneetoz.websiteLink,
      whatsappLink: store.settings.magneetoz.whatsappLink,
      instagramLink: store.settings.magneetoz.instagramLink,
      qrCodes: store.settings.magneetoz.qrCodes,
      videos: store.settings.magneetoz.videos
    };
    patchStore({ settings: { ...store.settings, magneetoz } });
    void saveCentralMagneetoz(magneetoz).catch(() => {
      window.alert("Magneetoz central save failed. Firestore rules/env check karo. Local screen update ho gaya, lekin dusre devices par sync nahi hoga.");
    });
  }
  return (
    <section className="section">
      <p className="eyebrow">Magneetoz Control</p>
      <h1 className="mt-2 text-5xl font-black">Central Promotion & Analytics</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{totalClicks}</strong><span>Promotion clicks</span></div>
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{totalOrders}</strong><span>Total orders</span></div>
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{money(totalRevenue)}</strong><span>Total revenue</span></div>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form className="premium-card grid gap-3 p-5 text-zinc-950" action={savePromotion}>
          <h2 className="text-2xl font-black">Central Content Manager</h2>
          <label className="flex gap-2 font-bold"><input name="enabled" type="checkbox" defaultChecked={store.settings.magneetoz.enabled} /> Show offer on website</label>
          <input name="restaurantName" className="field" defaultValue={store.settings.magneetoz.restaurantName} placeholder="Restaurant name" />
          <input name="title" className="field" defaultValue={store.settings.magneetoz.title} placeholder="Offer headline" />
          <textarea name="description" className="field" defaultValue={store.settings.magneetoz.description} placeholder="Offer description" />
          <input name="discountDetails" className="field" defaultValue={store.settings.magneetoz.discountDetails} placeholder="Discount details" />
          <input name="couponText" className="field" defaultValue={store.settings.magneetoz.couponText} placeholder="Coupon text" />
          <textarea name="pgCoupons" className="field" defaultValue={formatPgCoupons(store.settings.magneetoz.pgCoupons)} placeholder={"Har PG coupon ko alag line me likho:\nAPBOYS=APBOYS50\nSHARMA_PG=SHARMA100"} />
          <input name="buttonText" className="field" defaultValue={store.settings.magneetoz.buttonText} placeholder="Button text" />
          <textarea name="foodImages" className="field" defaultValue={store.settings.magneetoz.foodImages.join("\n")} placeholder={"Extra slide image links yahan paste karo. Har image URL new line me:\nhttps://image1...\nhttps://image2..."} />
          <button className="btn btn-dark">Save Offer</button>
        </form>
        <div>
          <MagneetozBanner settings={store.settings} pgSourceId={pgSourceId} />
          <div className="premium-card mt-6 p-5 text-zinc-950">
            <h2 className="text-2xl font-black">Connected PG Websites</h2>
            <div className="mt-3 grid gap-3">
              {byPg.map((site) => <div key={site.id} className="rounded-lg border border-black/10 p-3"><strong>{site.name}</strong><p className="text-sm text-zinc-500">Source: {site.sourceId} | Clicks {site.clicks} | Orders {site.orders} | Revenue {money(site.revenue)}</p></div>)}
            </div>
          </div>
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
  const pending = balance(student);
  const credit = advanceCredit(student);
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
            <span className={pending === 0 ? "font-black text-emerald-700" : "font-black text-rose-700"}>{pending === 0 ? "Payment Clear" : `${money(pending)} Pending`}</span>
          </div>
        </div>
      </div>
      {student.status !== "Left" && (
        <div className={`premium-card mt-6 p-5 text-zinc-950 ${pending > 0 ? "border-amber-400 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
          <h2 className="text-2xl font-black">{pending > 0 ? "This Month Due Started" : "Fees Clear"}</h2>
          <p className="mt-2">{pending > 0 ? `Your current pending due is ${money(pending)}. Please pay this month due.` : credit > 0 ? `You have ${money(credit)} advance credit for upcoming month.` : "No pending due right now."}</p>
          <p className="mt-1 text-sm text-zinc-600">Next billing date: {nextBillingDate(student.joiningDate)}</p>
          {pending > 0 && <button className="btn btn-dark mt-4" onClick={() => payOnline(student)}>Pay Pending Due</button>}
        </div>
      )}
      {(student.alerts || []).length > 0 && <div className="premium-card mt-6 p-5 text-zinc-950"><h2 className="text-2xl font-black">Admin Alerts</h2>{student.alerts?.map((alert, index) => <p key={`${alert}-${index}`} className="mt-3 rounded-lg bg-amber-50 p-3 font-bold text-amber-950">{alert}</p>)}</div>}
      <button className="btn btn-dark mt-6" onClick={() => downloadStudentPdf(store, student)}>Download My PDF</button>
      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Profile</h2><p className="mt-3 text-zinc-600">{student.studentId} | Room {student.roomNumber}, Bed {student.bedNumber}</p><p>{student.roomType} | {student.accommodationType}</p></div>
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Fees</h2><p>Total Due Till Now: {money(totalDue(student))}</p><p>Paid: {money(student.paidAmount)}</p><p>Remaining: {money(pending)}</p>{pending > 0 && <button className="btn btn-dark mt-4" onClick={() => payOnline(student)}>Pay Online</button>}</div>
        <div className="premium-card p-5 text-zinc-950"><h2 className="text-2xl font-black">Emergency</h2><p>{store.settings.contactNumber}</p><p>WhatsApp: {store.settings.whatsappNumber}</p></div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{fullyPaid}</strong><span className="text-zinc-500">Students payment done</span></div>
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{pendingStudents}</strong><span className="text-zinc-500">Students payment pending</span></div>
        <div className="premium-card p-5 text-zinc-950"><strong className="block text-3xl">{pending === 0 ? "Done" : "Pending"}</strong><span className="text-zinc-500">Your monthly status</span></div>
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
    <article className="group overflow-hidden rounded-[24px] border border-white/10 bg-white/10 shadow-2xl transition duration-300 hover:-translate-y-1 hover:bg-white/15">
      <img src={room.photos[0]} alt={`Room ${room.roomNumber}`} className="h-60 w-full object-cover transition duration-500 group-hover:scale-105" />
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
  return <div className="premium-card p-5 text-zinc-950"><Utensils className="mb-3 rounded-2xl bg-amber-50 p-2 text-amber-700" size={40} /><strong>{day}</strong><p className="mt-2 text-sm leading-6 text-zinc-600">{meal.breakfast}<br />{meal.lunch}<br />{meal.dinner}</p></div>;
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
  return <div className="premium-card mt-3 p-5"><strong>{notice.title}</strong><p className="text-sm text-zinc-500">{notice.date} | {notice.priority}</p><p className="mt-2 leading-7">{notice.description}</p></div>;
}

function balance(student: Student) {
  return Math.max(totalDue(student) - student.paidAmount, 0);
}

function advanceCredit(student: Student) {
  return Math.max(student.paidAmount - totalDue(student), 0);
}

function totalDue(student: Student) {
  const monthlyCycles = billingCycleCount(student.joiningDate, student.status === "Left" ? student.exitDate : undefined);
  return student.securityAmount + (monthlyCycles * student.rentAmount);
}

function billingCycleCount(joiningDate: string, stopDate?: string) {
  const start = parseDate(joiningDate);
  const end = stopDate ? parseDate(stopDate) : new Date();
  if (end < start) return 1;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(1, months + 1);
}

function nextBillingDate(joiningDate: string) {
  const start = parseDate(joiningDate);
  const today = new Date();
  let next = new Date(today.getFullYear(), today.getMonth(), start.getDate());
  if (next <= today) next = new Date(today.getFullYear(), today.getMonth() + 1, start.getDate());
  return next.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const parsed = value ? new Date(`${value}T00:00:00`) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function createRevenueEntry(input: Omit<RevenueEntry, "id" | "date" | "createdAt" | "updatedAt" | "deleted"> & { date?: string }) {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), date: input.date || todayIso(), createdAt: now, updatedAt: now, deleted: false, ...input };
}

function createInitialStudentRevenue(student: Student) {
  const entries: RevenueEntry[] = [];
  let remaining = student.paidAmount;
  const base = {
    propertyId: pgSourceId,
    paymentMode: "Cash" as PaymentMode,
    tenantId: student.studentId,
    tenantName: student.fullName,
    date: student.joiningDate,
    proofUrl: ""
  };

  if (remaining > 0 && student.securityAmount > 0) {
    const securityAmount = Math.min(remaining, student.securityAmount);
    entries.push(createRevenueEntry({
      ...base,
      category: "Security Deposit Collection",
      amount: securityAmount,
      receiptNumber: `SEC-${Date.now()}`,
      notes: `Initial security deposit collected during admission from ${student.fullName}`
    }));
    remaining -= securityAmount;
  }

  if (remaining > 0) {
    entries.push(createRevenueEntry({
      ...base,
      category: "Room Rent Collection",
      amount: remaining,
      receiptNumber: `RENT-${Date.now()}`,
      notes: `Initial rent/fee collected during admission from ${student.fullName}`
    }));
  }

  return entries;
}

function createExpenseEntry(input: Omit<ExpenseEntry, "id" | "createdAt" | "updatedAt" | "deleted">) {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, deleted: false, ...input };
}

function createAudit(entityType: AuditLog["entityType"], entityId: string, action: AuditLog["action"], summary: string): AuditLog {
  return { id: crypto.randomUUID(), propertyId: pgSourceId, entityType, entityId, action, actor: adminEmail, timestamp: new Date().toISOString(), summary };
}

function sumAmount(entries: Array<{ amount: number }>) {
  return entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
}

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function buildMonthlyFinanceData(revenues: RevenueEntry[], expenses: ExpenseEntry[]) {
  const months = Array.from(new Set([...revenues.map((entry) => entry.date.slice(0, 7)), ...expenses.map((entry) => entry.expenseDate.slice(0, 7)), todayIso().slice(0, 7)])).sort().slice(-12);
  return months.map((month) => {
    const revenue = sumAmount(revenues.filter((entry) => entry.date.startsWith(month)));
    const expense = sumAmount(expenses.filter((entry) => entry.expenseDate.startsWith(month)));
    return { month, revenue, expense, profit: revenue - expense };
  });
}

function topCategories(expenses: ExpenseEntry[]) {
  const totals = expenses.reduce<Record<string, number>>((result, entry) => {
    result[entry.category] = (result[entry.category] || 0) + entry.amount;
    return result;
  }, {});
  return Object.entries(totals).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount).slice(0, 8);
}

function exportFinanceCsv(revenues: RevenueEntry[], expenses: ExpenseEntry[]) {
  const rows = ["type,category,amount,paymentMode,date,party,reference,notes"];
  revenues.forEach((entry) => rows.push(`Revenue,${csv(entry.category)},${entry.amount},${entry.paymentMode},${entry.date},${csv(entry.tenantName || "")},${csv(entry.receiptNumber)},${csv(entry.notes)}`));
  expenses.forEach((entry) => rows.push(`Expense,${csv(entry.category)},${entry.amount},${entry.paymentMode},${entry.expenseDate},${csv(entry.vendorName)},${csv(entry.invoiceNumber)},${csv(entry.notes)}`));
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `finance-report-${todayIso()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function csv(value: string) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function downloadFinancePdf(store: Store) {
  const revenues = store.revenues.filter((entry) => !entry.deleted);
  const expenses = store.expenses.filter((entry) => !entry.deleted);
  const revenue = sumAmount(revenues);
  const expense = sumAmount(expenses);
  openPdfWindow(store.settings.pgName, "Profit & Loss Statement", `
    <section class="student">
      <div class="grid">
        <div><span>Gross Revenue</span><strong>${money(revenue)}</strong></div>
        <div><span>Total Expenses</span><strong>${money(expense)}</strong></div>
        <div><span>Net Profit</span><strong>${money(revenue - expense)}</strong></div>
        <div><span>Profit Percentage</span><strong>${percent(revenue - expense, revenue)}%</strong></div>
      </div>
      <h3>Recent Revenue</h3>
      <table><tbody>${revenues.slice(0, 20).map((entry) => `<tr><td>${entry.date}</td><td>${escapeHtml(entry.category)}</td><td>${money(entry.amount)}</td></tr>`).join("")}</tbody></table>
      <h3>Recent Expenses</h3>
      <table><tbody>${expenses.slice(0, 20).map((entry) => `<tr><td>${entry.expenseDate}</td><td>${escapeHtml(entry.category)}</td><td>${money(entry.amount)}</td></tr>`).join("")}</tbody></table>
    </section>
  `);
}

function money(value: number) {
  return `Rs. ${value.toLocaleString("en-IN")}`;
}

function labelize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function splitLines(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

function formatPgCoupons(coupons: Record<string, string> = {}) {
  return Object.entries(coupons).map(([source, coupon]) => `${source}=${coupon}`).join("\n");
}

function parsePgCoupons(value: string) {
  return value.split("\n").reduce<Record<string, string>>((result, line) => {
    const [source, coupon] = line.split("=").map((item) => item?.trim());
    if (source && coupon) result[source] = coupon;
    return result;
  }, {});
}

function normalizeStore(saved: Partial<Store>): Store {
  const savedSettings: Partial<SiteSettings> = saved.settings || {};
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
    students: (saved.students || seedStore.students).map((student) => ({ ...student, status: student.status || "Active" })),
    notices: saved.notices || seedStore.notices,
    complaints: saved.complaints || seedStore.complaints,
    rooms: saved.rooms || seedStore.rooms,
    magneetozEvents: saved.magneetozEvents || seedStore.magneetozEvents,
    connectedPgSites: saved.connectedPgSites || seedStore.connectedPgSites,
    revenues: saved.revenues || seedStore.revenues,
    expenses: saved.expenses || seedStore.expenses,
    budgets: saved.budgets || seedStore.budgets,
    recurringExpenses: saved.recurringExpenses || seedStore.recurringExpenses,
    auditLogs: saved.auditLogs || seedStore.auditLogs
  };
}

function serializePgStore(store: Store): Store {
  return {
    ...store,
    magneetozEvents: [],
    settings: {
      ...store.settings,
      magneetoz: seedStore.settings.magneetoz
    }
  };
}

function downloadAllStudentsPdf(store: Store) {
  const rows = store.students.map((student) => `
    <section class="student">
      ${studentReportHtml(store, student)}
    </section>
  `).join("");
  openPdfWindow(store.settings.pgName, "All Students Fee & Admission Report", rows);
}

function downloadStudentPdf(store: Store, student: Student) {
  openPdfWindow(store.settings.pgName, `${student.fullName} - Student Report`, studentReportHtml(store, student));
}

function studentReportHtml(store: Store, student: Student) {
  const payments = student.paymentHistory.length
    ? student.paymentHistory.map((payment) => `
      <tr>
        <td>${escapeHtml(payment.date)}</td>
        <td>${escapeHtml(payment.mode)}</td>
        <td>${escapeHtml(payment.receiptId)}</td>
        <td>${money(payment.amount)}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="4">No payment recorded.</td></tr>`;

  return `
    <div class="identity">
      <div>
        <p class="label">Student Name</p>
        <h2>${escapeHtml(student.fullName)}</h2>
      </div>
      <div class="status">${escapeHtml(student.status || "Active")}</div>
    </div>
    <div class="grid">
      <div><span>Student ID</span><strong>${escapeHtml(student.studentId)}</strong></div>
      <div><span>Father Name</span><strong>${escapeHtml(student.fatherName)}</strong></div>
      <div><span>Phone</span><strong>${escapeHtml(student.phone)}</strong></div>
      <div><span>Email</span><strong>${escapeHtml(student.email)}</strong></div>
      <div><span>Room / Bed</span><strong>${escapeHtml(student.roomNumber)} / ${escapeHtml(student.bedNumber)}</strong></div>
      <div><span>Room Type</span><strong>${escapeHtml(student.roomType)} | ${escapeHtml(student.accommodationType)}</strong></div>
      <div><span>Joining Date</span><strong>${escapeHtml(student.joiningDate)}</strong></div>
      <div><span>Exit Date</span><strong>${escapeHtml(student.exitDate || "-")}</strong></div>
      <div><span>Total Due Till Now</span><strong>${money(totalDue(student))}</strong></div>
      <div><span>Deposited</span><strong>${money(student.paidAmount)}</strong></div>
      <div><span>Pending</span><strong>${money(balance(student))}</strong></div>
      <div><span>Advance Credit</span><strong>${money(advanceCredit(student))}</strong></div>
    </div>
    <h3>Payment History</h3>
    <table>
      <thead><tr><th>Date</th><th>Mode</th><th>Receipt</th><th>Amount</th></tr></thead>
      <tbody>${payments}</tbody>
    </table>
  `;
}

function openPdfWindow(hostelName: string, title: string, body: string) {
  const printWindow = window.open("", "_blank", "width=900,height=1100");
  if (!printWindow) {
    window.alert("Popup blocked. Please allow popups to download PDF.");
    return;
  }
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #f6f2ea; color: #161616; font-family: Arial, sans-serif; }
          .page { padding: 32px; }
          .header { background: linear-gradient(135deg, #111, #3a260e); color: white; border-radius: 24px; padding: 28px; margin-bottom: 24px; }
          .header p { margin: 0; color: #f5bd47; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; font-size: 12px; }
          .header h1 { margin: 8px 0 0; font-size: 34px; }
          .header h2 { margin: 8px 0 0; font-size: 18px; color: rgba(255,255,255,.75); }
          .student { background: white; border: 1px solid #e7ded0; border-radius: 20px; padding: 22px; margin-bottom: 22px; page-break-inside: avoid; }
          .identity { display: flex; justify-content: space-between; gap: 18px; align-items: start; border-bottom: 1px solid #eee3d5; padding-bottom: 16px; margin-bottom: 16px; }
          .label, .grid span { color: #8a7560; font-size: 12px; margin: 0 0 5px; text-transform: uppercase; font-weight: 900; letter-spacing: .05em; }
          h2 { margin: 0; font-size: 26px; }
          h3 { margin: 20px 0 10px; }
          .status { background: #f5bd47; padding: 9px 13px; border-radius: 999px; font-weight: 900; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .grid div { background: #fbf7ef; border: 1px solid #eee3d5; border-radius: 14px; padding: 12px; }
          .grid strong { display: block; font-size: 15px; }
          table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 14px; }
          th { background: #151515; color: white; text-align: left; padding: 11px; font-size: 13px; }
          td { border-bottom: 1px solid #eee3d5; padding: 11px; font-size: 13px; }
          @media print {
            body { background: white; }
            .page { padding: 0; }
            .student { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="header">
            <p>Premium Hostel Report</p>
            <h1>${escapeHtml(hostelName)}</h1>
            <h2>${escapeHtml(title)}</h2>
          </section>
          ${body}
        </main>
        <script>
          window.onload = () => {
            window.focus();
            window.print();
          };
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function escapeHtml(value: string) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isEmbeddableMap(value: string) {
  return value.includes("google.com/maps/embed") || value.includes("www.google.com/maps/embed");
}

function whatsappReminderLink(hostelName: string, student: Student) {
  const phone = student.phone.replace(/\D/g, "");
  const amount = money(balance(student));
  const dueDate = nextBillingDate(student.joiningDate);
  const message = [
    `Dear ${student.fullName},`,
    `You have a pending due of ${amount} at ${hostelName}.`,
    `Kindly clear it by today to keep your hostel account updated.`,
    `Student ID: ${student.studentId}`,
    `Room: ${student.roomNumber}, Bed: ${student.bedNumber}`,
    `Next billing date: ${dueDate}`,
    "If you have already paid, please ignore this message and share the payment receipt with admin.",
    `Thank you, ${hostelName}`
  ].join("\n");
  return `https://wa.me/${phone.startsWith("91") ? phone : `91${phone}`}?text=${encodeURIComponent(message)}`;
}
