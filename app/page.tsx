export default function Page() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fb] px-5 py-8 font-sans">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 20%, rgba(37,99,235,0.10), transparent 32%), radial-gradient(circle at 82% 78%, rgba(15,23,42,0.08), transparent 34%)",
        }}
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-[920px] items-center justify-center">
        <div className="w-full overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.14)]">
          <div className="h-2 w-full bg-[#12345b]" />

          <div className="px-7 py-12 text-center sm:px-12 sm:py-16">
            <img
              src="/cnet.png"
              alt="CNETMOBİL"
              className="mx-auto h-[46px] w-auto object-contain sm:h-[52px]"
            />

            <div className="mx-auto mt-10 flex h-24 w-24 items-center justify-center rounded-[28px] bg-red-50 ring-1 ring-red-100">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-11 w-11 text-red-600"
                aria-hidden="true"
              >
                <rect x="5" y="10" width="14" height="10" rx="2.5" />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 10V7.5a4 4 0 0 1 8 0V10"
                />
              </svg>
            </div>

            <h1 className="mt-8 text-[28px] font-black tracking-[-0.03em] text-slate-950 sm:text-[36px]">
              PANEL KULLANIMA KAPATILMIŞTIR
            </h1>

            <p className="mx-auto mt-4 max-w-[560px] text-[15px] font-medium leading-7 text-slate-500 sm:text-[17px]">
              Bu panel artık aktif olarak kullanılmamaktadır
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
