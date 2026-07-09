import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/public/submit-button";
import { completeSignupAction } from "@/lib/actions/signup";
import { PENDING_SIGNUP_COOKIE_NAME, verifyPendingSignupToken } from "@/lib/auth/signup";

const BOULDERING_GRADES = ["V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15", "V16", "V17"];
const SPORT_GRADES = [
  "5.6",
  "5.7",
  "5.8",
  "5.9",
  "5.10a",
  "5.10b",
  "5.10c",
  "5.10d",
  "5.11a",
  "5.11b",
  "5.11c",
  "5.11d",
  "5.12a",
  "5.12b",
  "5.12c",
  "5.12d",
  "5.13a",
  "5.13b",
  "5.13c",
  "5.13d",
  "5.14a",
  "5.14b",
  "5.14c",
  "5.14d",
  "5.15a"
];

type SignupPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const cookieStore = await cookies();
  const pendingToken = cookieStore.get(PENDING_SIGNUP_COOKIE_NAME)?.value;
  const pendingSignup = pendingToken ? await verifyPendingSignupToken(pendingToken) : null;
  if (!pendingSignup) {
    redirect("/login?error=signup_expired");
  }

  const params = (await searchParams) ?? {};
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="min-h-screen bg-black px-4 text-white">
      <section className="mx-auto min-h-screen w-full max-w-[390px] px-0 pb-12 pt-[74px]">
        <h1 className="text-[22px] font-black leading-[1.45] tracking-[-0.01em]">
          가입을 위한 정보를
          <br />
          입력해주세요.
        </h1>

        {error ? <p className="mt-4 text-[12px] font-semibold text-[#FF6868]">입력 정보를 다시 확인해주세요.</p> : null}

        <form action={completeSignupAction} className="mt-8 space-y-5">
          <label className="block">
            <span className="block text-[14px] font-medium text-white">닉네임 *</span>
            <input
              name="nickname"
              required
              autoComplete="nickname"
              placeholder="Instagram ID 추천"
              className="mt-2 h-12 w-full rounded-[7px] border-0 bg-[#3D3D3D] px-4 text-[14px] font-medium text-white outline-none placeholder:text-[#8B8B8B] focus:ring-1 focus:ring-white"
            />
          </label>

          <fieldset>
            <legend className="text-[14px] font-medium text-white">성별 *</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label>
                <input className="peer sr-only" type="radio" name="gender" value="male" required />
                <span className="flex h-12 items-center justify-center rounded-[7px] border border-transparent bg-[#3D3D3D] text-[14px] font-medium text-[#8B8B8B] peer-checked:border-white peer-checked:text-white">
                  남자
                </span>
              </label>
              <label>
                <input className="peer sr-only" type="radio" name="gender" value="female" required />
                <span className="flex h-12 items-center justify-center rounded-[7px] border border-transparent bg-[#3D3D3D] text-[14px] font-medium text-[#8B8B8B] peer-checked:border-white peer-checked:text-white">
                  여자
                </span>
              </label>
            </div>
          </fieldset>

          <section>
            <h2 className="text-[16px] font-medium text-white">Body</h2>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <UnitInput name="heightCm" placeholder="키" />
              <UnitInput name="apeIndexCm" placeholder="암스팬" />
              <UnitInput name="weightKg" placeholder="몸무게" unit="kg" />
            </div>
          </section>

          <section>
            <h2 className="text-[16px] font-medium text-white">Redpoint</h2>
            <div className="mt-2 space-y-3">
              <GradeSelect name="topBoulderingGrade" label="Top Bouldering Grade" placeholder="V Grade 선택" options={BOULDERING_GRADES} />
              <GradeSelect name="topSportGrade" label="Top Sports Grade" placeholder="Yosemite Grade 선택" options={SPORT_GRADES} />
            </div>
          </section>

          <SubmitButton
            pendingText="가입 중"
            className="mt-10 h-[54px] w-full rounded-[27px] bg-white text-[15px] font-bold text-black transition active:scale-[0.99]"
          >
            시작하기
          </SubmitButton>
        </form>
      </section>
    </main>
  );
}

function UnitInput({ name, placeholder, unit = "cm" }: { name: string; placeholder: string; unit?: string }) {
  return (
    <label className="relative block">
      <input
        name={name}
        type="number"
        inputMode="numeric"
        min="1"
        max="300"
        placeholder={placeholder}
        className="h-12 w-full rounded-[7px] border-0 bg-[#3D3D3D] px-4 pr-10 text-[14px] font-medium text-white outline-none placeholder:text-[#8B8B8B] focus:ring-1 focus:ring-white"
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-white">{unit}</span>
    </label>
  );
}

function GradeSelect({
  name,
  label,
  placeholder,
  options
}: {
  name: string;
  label: string;
  placeholder: string;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-[#8B8B8B]">{label}</span>
      <span className="relative mt-1 block">
        <select
          name={name}
          defaultValue=""
          className="h-12 w-full appearance-none rounded-[7px] border-0 bg-[#3D3D3D] px-4 pr-11 text-[14px] font-medium text-white outline-none focus:ring-1 focus:ring-white"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-white" />
      </span>
    </label>
  );
}
