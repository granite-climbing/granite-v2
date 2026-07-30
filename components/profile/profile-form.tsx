import React from "react";
import { SubmitButton } from "@/components/public/submit-button";

const BOULDERING_GRADES = ["V0", "V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15", "V16", "V17"];
const SPORT_GRADES = [
  "5.6", "5.7", "5.8", "5.9", "5.10a", "5.10b", "5.10c", "5.10d", "5.11a", "5.11b", "5.11c", "5.11d",
  "5.12a", "5.12b", "5.12c", "5.12d", "5.13a", "5.13b", "5.13c", "5.13d", "5.14a", "5.14b", "5.14c", "5.14d", "5.15a"
];

export type ProfileFormValues = {
  nickname: string;
  instagramId: string | null;
  gender: "male" | "female" | null;
  heightCm: number | null;
  apeIndexCm: number | null;
  weightKg: number | null;
  topBoulderingGrade: string | null;
  topSportGrade: string | null;
  youtubeUrl: string | null;
};

type ProfileFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  initialValues?: Partial<ProfileFormValues>;
};

export function ProfileForm({ action, submitLabel, initialValues = {} }: ProfileFormProps) {
  return (
    <form action={action} className="mt-8 space-y-5">
      <label className="block">
        <span className="block text-[14px] font-medium text-white">닉네임 *</span>
        <input name="nickname" required autoComplete="nickname" defaultValue={initialValues.nickname} placeholder="Instagram ID 추천" className="mt-2 h-12 w-full rounded-[7px] border-0 bg-[#3D3D3D] px-4 text-[14px] font-medium text-white outline-none placeholder:text-[#8B8B8B] focus:ring-1 focus:ring-white" />
      </label>

      <label className="block">
        <span className="block text-[14px] font-medium text-white">Instagram ID (선택)</span>
        <input name="instagramId" autoComplete="username" defaultValue={initialValues.instagramId ?? ""} placeholder="@granite" className="mt-2 h-12 w-full rounded-[7px] border-0 bg-[#3D3D3D] px-4 text-[14px] font-medium text-white outline-none placeholder:text-[#8B8B8B] focus:ring-1 focus:ring-white" />
      </label>

      <fieldset>
        <legend className="text-[14px] font-medium text-white">성별 *</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <RadioOption value="male" label="남자" checked={initialValues.gender === "male"} />
          <RadioOption value="female" label="여자" checked={initialValues.gender === "female"} />
        </div>
      </fieldset>

      <section>
        <h2 className="text-[16px] font-medium text-white">Body</h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <UnitInput name="heightCm" placeholder="키" value={initialValues.heightCm} />
          <UnitInput name="apeIndexCm" placeholder="암스팬" value={initialValues.apeIndexCm} />
          <UnitInput name="weightKg" placeholder="몸무게" unit="kg" value={initialValues.weightKg} />
        </div>
      </section>

      <section>
        <h2 className="text-[16px] font-medium text-white">Redpoint</h2>
        <div className="mt-2 space-y-3">
          <GradeSelect name="topBoulderingGrade" label="Top Bouldering Grade" placeholder="V Grade 선택" options={BOULDERING_GRADES} value={initialValues.topBoulderingGrade} />
          <GradeSelect name="topSportGrade" label="Top Sports Grade" placeholder="Yosemite Grade 선택" options={SPORT_GRADES} value={initialValues.topSportGrade} />
        </div>
      </section>

      <label className="block">
        <span className="block text-[14px] font-medium text-white">YouTube 채널 URL (선택)</span>
        <input name="youtubeUrl" type="url" inputMode="url" autoComplete="url" defaultValue={initialValues.youtubeUrl ?? ""} placeholder="https://youtube.com/@channel" className="mt-2 h-12 w-full rounded-[7px] border-0 bg-[#3D3D3D] px-4 text-[14px] font-medium text-white outline-none placeholder:text-[#8B8B8B] focus:ring-1 focus:ring-white" />
      </label>

      <SubmitButton pendingText="저장 중" className="mt-10 h-[54px] w-full rounded-[27px] bg-white text-[15px] font-bold text-black transition active:scale-[0.99]">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}

function RadioOption({ value, label, checked }: { value: "male" | "female"; label: string; checked: boolean }) {
  return <label><input className="peer sr-only" type="radio" name="gender" value={value} required defaultChecked={checked} /><span className="flex h-12 items-center justify-center rounded-[7px] border border-transparent bg-[#3D3D3D] text-[14px] font-medium text-[#8B8B8B] peer-checked:border-white peer-checked:text-white">{label}</span></label>;
}

function UnitInput({ name, placeholder, unit = "cm", value }: { name: string; placeholder: string; unit?: string; value?: number | null }) {
  return <label className="relative block"><input name={name} type="number" inputMode="numeric" min="1" max="300" defaultValue={value ?? ""} placeholder={placeholder} className="h-12 w-full rounded-[7px] border-0 bg-[#3D3D3D] px-4 pr-10 text-[14px] font-medium text-white outline-none placeholder:text-[#8B8B8B] focus:ring-1 focus:ring-white" /><span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[14px] font-medium text-white">{unit}</span></label>;
}

function GradeSelect({ name, label, placeholder, options, value }: { name: string; label: string; placeholder: string; options: string[]; value?: string | null }) {
  return <label className="block"><span className="block text-[13px] font-medium text-[#8B8B8B]">{label}</span><span className="relative mt-1 block"><select name={name} defaultValue={value ?? ""} className="h-12 w-full appearance-none rounded-[7px] border-0 bg-[#3D3D3D] px-4 pr-11 text-[14px] font-medium text-white outline-none focus:ring-1 focus:ring-white"><option value="" disabled>{placeholder}</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select><span className="pointer-events-none absolute right-4 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-white" /></span></label>;
}
