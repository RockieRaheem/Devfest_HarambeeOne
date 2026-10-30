"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  HandHeart,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { MetricCard, PageHeader, SectionHeader, Status } from "@/components/ui";
import NotificationCenter from "@/components/NotificationCenter";
import { getSelectedPeriod } from "@/lib/period";
import { getPrimarySchool, type School } from "@/lib/school";
import { clientFetch as fetch } from "@/lib/api/client";

const API = "/api/backend";
type Student = { id: string; admission_no: string; full_name: string };
type Requirement = {
  id: string;
  requirement_name: string;
  requirement_type: string;
  outstanding_amount: string;
};
type Eligibility = { general_outstanding: string; eligible: boolean };
type Case = {
  id: string;
  public_code: string;
  student_name: string;
  admission_no: string;
  title: string;
  target_amount: string;
  verified_amount: string;
  pending_amount: string;
  status: string;
  has_ai_review: boolean;
  guardian_authored: boolean;
  review_notes: string | null;
};
type Detail = {
  id: string;
  public_code: string;
  student: { name: string; admission_no: string };
  title: string;
  public_summary: string;
  private_context: string | null;
  need_category: string;
  target_amount: string;
  verified_amount: string;
  pending_amount: string;
  status: string;
  guardian_authored: boolean;
  review_notes: string | null;
  guardians: {
    id: string;
    name: string;
    relationship: string;
    portal_linked: boolean;
  }[];
  consent: null | {
    method: string;
    gemini_processing: boolean;
    public_media_consent: boolean;
  };
  media: null | {
    status: string;
    alt_text: string;
    content_hash: string;
    width: number;
    height: number;
  };
  ai_review: null | { consistency_flags: string[]; recommended_action: string };
};
type Pledge = {
  id: string;
  public_reference: string;
  external_reference: string;
  donor_display_name: string;
  amount: string;
  status: string;
};
type Destination = {
  id: string;
  channel: string;
  label: string;
  provider_name: string;
  account_name: string;
  account_reference: string;
  instructions: string;
  verification_status: string;
};
type Candidate = {
  student_id: string;
  student_name: string;
  admission_no: string;
  class_name: string;
  overdue_amount: string;
  days_overdue: number;
  priority_band: string;
  guardian_link_id: string | null;
  guardian_email: string | null;
  guardian_portal_linked: boolean;
  referral_id: string | null;
  referral_status: string | null;
};
const money = (value: string | number) =>
  `UGX ${Number(value).toLocaleString("en-UG")}`;

export default function SupportAdmin() {
  const evidenceInputRef = useRef<HTMLInputElement>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [periodId, setPeriodId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [modal, setModal] = useState<
    "case" | "edit" | "consent" | "proof" | "destination" | "media" | null
  >(null);
  const [caseStudentId, setCaseStudentId] = useState("");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [requirementId, setRequirementId] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [generalOutstanding, setGeneralOutstanding] = useState(0);
  const [obligationsLoading, setObligationsLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [guardianInvite, setGuardianInvite] = useState<{
    guardianId: string;
    email: string;
    path: string;
  } | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const load = useCallback(async (schoolId: string, period: string) => {
    const [
      studentResponse,
      caseResponse,
      candidateResponse,
      destinationResponse,
    ] = await Promise.all([
      fetch(`${API}/api/v1/students?school_id=${schoolId}&period_id=${period}`),
      fetch(`${API}/api/v1/support/cases?school_id=${schoolId}`),
      fetch(
        `${API}/api/v1/support/referral-candidates?school_id=${schoolId}&period_id=${period}`,
      ),
      fetch(`${API}/api/v1/support/payment-destinations?school_id=${schoolId}`),
    ]);
    const studentBody = await apiBody<{ items: Student[]; detail?: string }>(
      studentResponse,
    );
    const caseBody = await apiBody<Case[] & { detail?: string }>(caseResponse);
    if (!studentResponse.ok || !caseResponse.ok)
      throw new Error(
        studentBody.detail ??
          caseBody.detail ??
          "Learner support could not be loaded.",
      );
    setStudents(studentBody.items);
    setCases(caseBody.filter((item) => item.status !== "withdrawn"));
    if (candidateResponse.ok)
      setCandidates(
        (await apiBody<{ items: Candidate[] }>(candidateResponse)).items,
      );
    if (destinationResponse.ok)
      setDestinations(await apiBody<Destination[]>(destinationResponse));
  }, []);

  useEffect(() => {
    Promise.all([getPrimarySchool(), getSelectedPeriod()])
      .then(([currentSchool, period]) => {
        setSchool(currentSchool);
        setPeriodId(period.id);
        return load(currentSchool.id, period.id);
      })
      .catch((reason) =>
        setError(reason.message ?? "Learner support could not be loaded."),
      );
  }, [load]);

  useEffect(() => {
    if (!school || !caseStudentId) {
      setRequirements([]);
      setGeneralOutstanding(0);
      return;
    }
    let cancelled = false;
    setObligationsLoading(true);
    setModalError("");
    Promise.all([
      fetch(
        `${API}/api/v1/requirement-assignments?school_id=${school.id}&period_id=${periodId}&student_id=${caseStudentId}`,
      ),
      fetch(
        `${API}/api/v1/support/eligibility?school_id=${school.id}&period_id=${periodId}&student_id=${caseStudentId}`,
      ),
    ])
      .then(async ([requirementResponse, eligibilityResponse]) => {
        const requirementBody = await apiBody<
          Requirement[] | { detail?: unknown }
        >(requirementResponse);
        const eligibilityBody = await apiBody<
          Eligibility & { detail?: unknown }
        >(eligibilityResponse);
        if (!requirementResponse.ok)
          throw new Error(
            apiError(
              "detail" in requirementBody ? requirementBody.detail : null,
              requirementResponse.status,
            ),
          );
        if (!eligibilityResponse.ok)
          throw new Error(
            apiError(eligibilityBody.detail, eligibilityResponse.status),
          );
        if (cancelled) return;
        const payable = (requirementBody as Requirement[]).filter(
          (item) =>
            ["payment", "school_item"].includes(item.requirement_type) &&
            Number(item.outstanding_amount) > 0,
        );
        const available = Number(eligibilityBody.general_outstanding);
        setRequirements(payable);
        setGeneralOutstanding(available);
        setTargetAmount(String(available || ""));
      })
      .catch((reason) => {
        if (!cancelled)
          setModalError(
            reason instanceof Error
              ? reason.message
              : "The learner obligations could not be loaded.",
          );
      })
      .finally(() => {
        if (!cancelled) setObligationsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseStudentId, periodId, school]);

  const openCase = useCallback(async (id: string) => {
    setError("");
    const [caseResponse, pledgeResponse] = await Promise.all([
      fetch(`${API}/api/v1/support/cases/${id}`),
      fetch(`${API}/api/v1/support/cases/${id}/pledges`),
    ]);
    const body = await apiBody<Detail & { detail?: string }>(caseResponse);
    if (!caseResponse.ok)
      return setError(body.detail ?? "Case could not be loaded.");
    setSelected(body);
    setPledges(
      pledgeResponse.ok ? await apiBody<Pledge[]>(pledgeResponse) : [],
    );
  }, []);

  useEffect(() => {
    if (!selected && cases.length) void openCase(cases[0].id);
  }, [cases, openCase, selected]);

  async function mutate(
    path: string,
    body: unknown,
    success: string,
    method: "POST" | "PATCH" = "POST",
  ) {
    if (!school) return;
    setBusy(true);
    setError("");
    setModalError("");
    setNotice("");
    try {
      const response = await fetch(`${API}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await apiBody<{ id?: string; detail?: unknown }>(response);
      if (!response.ok)
        throw new Error(apiError(result.detail, response.status));
      setNotice(success);
      setModal(null);
      await load(school.id, periodId);
      if (selected) await openCase(selected.id);
      return result;
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Action could not be completed.";
      if (modal) setModalError(message);
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setCaseStudentId("");
    setRequirements([]);
    setRequirementId("");
    setTargetAmount("");
    setGeneralOutstanding(0);
    setModalError("");
    setModal("case");
  }

  function chooseRequirement(id: string) {
    setRequirementId(id);
    const requirement = requirements.find((item) => item.id === id);
    setTargetAmount(
      String(
        requirement
          ? Number(requirement.outstanding_amount)
          : generalOutstanding || "",
      ),
    );
  }

  async function createCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!school) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const publicSummary = String(form.get("public_summary") ?? "").trim();
    const learner = students.find((student) => student.id === caseStudentId);
    const privateTokens = [
      learner?.admission_no,
      ...(learner?.full_name.split(/\s+/) ?? []),
    ].filter((value): value is string => Boolean(value && value.length >= 3));
    const publicText = `${title} ${publicSummary}`.toLocaleLowerCase();
    if (
      privateTokens.some((token) =>
        publicText.includes(token.toLocaleLowerCase()),
      )
    ) {
      setModalError(
        "Remove the learner name and admission number from the public title and summary. Use anonymous wording such as “A candidate needs examination support.”",
      );
      return;
    }
    const selectedRequirement = requirements.find(
      (item) => item.id === requirementId,
    );
    const available = selectedRequirement
      ? Number(selectedRequirement.outstanding_amount)
      : generalOutstanding;
    if (!available || Number(targetAmount) > available) {
      setModalError(
        `Enter a target no greater than the verified outstanding balance of ${money(available)}.`,
      );
      return;
    }
    const result = await mutate(
      "/api/v1/support/cases",
      {
        school_id: school.id,
        period_id: periodId,
        student_id: caseStudentId,
        requirement_assignment_id: requirementId || null,
        title,
        public_summary: publicSummary,
        need_category: form.get("need_category"),
        target_amount: Number(targetAmount),
      },
      "Private support case created. Complete consent and review before publication.",
    );
    if (result?.id) await openCase(result.id);
  }

  async function consent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(
      `/api/v1/support/cases/${selected.id}/consent`,
      {
        guardian_link_id: form.get("guardian_link_id"),
        method: form.get("method"),
        anonymous_publication: true,
        public_media_consent: form.get("public_media_consent") === "on",
        gemini_processing: true,
        cross_border_processing: true,
        child_assent_status: form.get("child_assent_status"),
      },
      "Guardian consent recorded.",
    );
  }

  async function review(
    image: string | null = null,
    mime: string | null = null,
  ) {
    if (!selected) return;
    await mutate(
      `/api/v1/support/cases/${selected.id}/ai-review`,
      {
        evidence_image_base64: image,
        evidence_mime_type: mime,
        evidence_redacted: Boolean(image),
      },
      image
        ? "Gemini completed the anonymous multimodal case review."
        : "Gemini completed the anonymous case review.",
    );
  }

  async function reviewEvidence(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > 2_000_000)
      return setError("Use a redacted image no larger than 2 MB.");
    if (
      !window.confirm(
        "Confirm that all names, faces, admission numbers and contact details are redacted.",
      )
    )
      return;
    await review(await fileBase64(file), file.type);
  }

  async function publish() {
    if (selected)
      await mutate(
        `/api/v1/support/cases/${selected.id}/publish`,
        {},
        "Campaign published to the donor portal.",
      );
  }
  async function editCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(
      `/api/v1/support/cases/${selected.id}`,
      {
        title: String(form.get("title") ?? "").trim(),
        public_summary: String(form.get("public_summary") ?? "").trim(),
        need_category: form.get("need_category"),
        target_amount: Number(form.get("target_amount")),
      },
      "Campaign details updated and recorded in the audit trail.",
      "PATCH",
    );
  }
  async function deleteCampaign() {
    if (
      !selected ||
      !window.confirm(
        `Delete ${selected.public_code} from public access? This preserves its private audit record and cannot be done after donor activity.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${API}/api/v1/support/cases/${selected.id}`,
        { method: "DELETE" },
      );
      const body = await apiBody<{ detail?: unknown }>(response);
      if (!response.ok) throw new Error(apiError(body.detail, response.status));
      setNotice(
        "Campaign deleted from public access. Its private audit record was preserved.",
      );
      setSelected(null);
      setPledges([]);
      if (school) await load(school.id, periodId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The campaign could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function reviewDecision(action: "request_changes" | "approve") {
    if (!selected) return;
    const note =
      action === "request_changes"
        ? window.prompt(
            "Tell the guardian exactly what must change before resubmission:",
          )
        : null;
    if (action === "request_changes" && !note?.trim()) return;
    await mutate(
      `/api/v1/support/cases/${selected.id}/review-decision`,
      { action, note },
      action === "approve"
        ? "Case approved. It is ready for owner publication."
        : "Changes requested. The guardian can now revise the private draft.",
    );
  }
  async function inviteGuardian(guardianId: string) {
    if (!school) return;
    setBusy(true);
    setError("");
    setGuardianInvite(null);
    try {
      const response = await fetch(
        `${API}/api/v1/support/guardian-invitations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school_id: school.id,
            guardian_link_id: guardianId,
          }),
        },
      );
      const body = await apiBody<{
        invited_email?: string;
        claim_path?: string;
        detail?: unknown;
      }>(response);
      if (!response.ok || !body.claim_path || !body.invited_email)
        throw new Error(apiError(body.detail, response.status));
      setGuardianInvite({
        guardianId,
        email: body.invited_email,
        path: body.claim_path,
      });
      setNotice(
        "Guardian invitation created. Share the private link only with the invited guardian.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Guardian invitation could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function createReferral(item: Candidate) {
    if (!school || !item.guardian_link_id) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API}/api/v1/support/referrals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_id: school.id,
          period_id: periodId,
          student_id: item.student_id,
          guardian_link_id: item.guardian_link_id,
        }),
      });
      const body = await apiBody<{ detail?: unknown }>(response);
      if (!response.ok) throw new Error(apiError(body.detail, response.status));
      setNotice("Private support referral sent to the guardian workspace.");
      await load(school.id, periodId);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Referral could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function decide(item: Pledge, action: "verify" | "reject") {
    const reason =
      action === "reject"
        ? window.prompt("Why is this contribution being rejected?")
        : null;
    if (action === "reject" && !reason) return;
    await mutate(
      `/api/v1/support/pledges/${item.id}/verify`,
      { action, reason },
      action === "verify"
        ? "Contribution verified and posted to the learner account."
        : "Contribution rejected.",
    );
  }
  async function reverse(item: Pledge) {
    const reason = window.prompt(
      "Enter the provider-confirmed reason for reversing this contribution:",
    );
    if (!reason?.trim()) return;
    await mutate(
      `/api/v1/support/pledges/${item.id}/reverse`,
      { reason },
      "Contribution reversed. The original payment and reversal remain in the audit trail.",
    );
  }
  async function reissue(item: Pledge) {
    const reason = window.prompt("Why is this receipt being reissued?");
    if (!reason?.trim()) return;
    await mutate(
      `/api/v1/support/pledges/${item.id}/receipt/reissue`,
      { reason },
      "The original official receipt was reissued and recorded in the audit trail.",
    );
  }
  async function createDestination(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!school) return;
    const form = new FormData(event.currentTarget);
    await mutate(
      "/api/v1/support/payment-destinations",
      {
        school_id: school.id,
        channel: form.get("channel"),
        label: form.get("label"),
        provider_name: form.get("provider_name"),
        account_name: school.name,
        account_reference: form.get("account_reference"),
        instructions: form.get("instructions"),
      },
      "Institution payment destination saved. Verify it before donors can see it.",
    );
  }
  async function decideDestination(
    item: Destination,
    action: "verify" | "disable",
  ) {
    await mutate(
      `/api/v1/support/payment-destinations/${item.id}/decision`,
      { action },
      action === "verify"
        ? "Payment destination verified and published to donors."
        : "Payment destination disabled.",
    );
  }
  async function proof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    await mutate(
      `/api/v1/support/cases/${selected.id}/attestations`,
      {
        attestation_type: form.get("attestation_type"),
        statement: form.get("statement"),
        attendance_band: form.get("attendance_band") || null,
      },
      "Outcome evidence submitted for privacy review.",
    );
  }
  async function media(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const file = form.get("image");
    if (!(file instanceof File) || !file.size)
      return setModalError("Choose a learner image.");
    if (file.size > 1_500_000)
      return setModalError(
        "Use a JPEG, PNG or WebP image no larger than 1.5 MB.",
      );
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return setModalError("Use a JPEG, PNG or WebP image.");
    await mutate(
      `/api/v1/support/cases/${selected.id}/media`,
      {
        image_base64: await fileBase64(file),
        image_mime_type: file.type,
        alt_text: String(form.get("alt_text") ?? "").trim(),
        guardian_media_consent_confirmed:
          form.get("guardian_confirmation") === "on",
        safeguarding_review_confirmed:
          form.get("safeguarding_confirmation") === "on",
      },
      "The consented, safeguarding-reviewed image is ready for the public campaign.",
    );
  }
  async function removeMedia() {
    if (
      !selected ||
      !window.confirm("Remove this learner image from the public campaign now?")
    )
      return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${API}/api/v1/support/cases/${selected.id}/media`,
        { method: "DELETE" },
      );
      const body = await apiBody<{ detail?: unknown }>(response);
      if (!response.ok) throw new Error(apiError(body.detail, response.status));
      setNotice("The learner image was removed from public access.");
      await openCase(selected.id);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The image could not be removed.",
      );
    } finally {
      setBusy(false);
    }
  }

  const target = cases.reduce(
    (sum, item) => sum + Number(item.target_amount),
    0,
  );
  const verified = cases.reduce(
    (sum, item) => sum + Number(item.verified_amount),
    0,
  );
  const pending = cases.reduce(
    (sum, item) => sum + Number(item.pending_amount),
    0,
  );
  const obligationLimit = requirementId
    ? Number(
        requirements.find((item) => item.id === requirementId)
          ?.outstanding_amount ?? 0,
      )
    : generalOutstanding;

  return (
    <>
      <input
        ref={evidenceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={reviewEvidence}
      />
      <NotificationCenter compact />
      <PageHeader
        eyebrow="Learner support · Controlled assistance"
        title="Harambee Support"
        description="Refer verified arrears, review guardian-authored cases and publish only safe anonymous campaigns."
        actions={
          <div className="page-header-actions">
            <Link className="btn" href="/support" target="_blank">
              Public portal <ExternalLink size={15} />
            </Link>
            {school?.role === "owner" && (
              <button className="btn" onClick={() => setModal("destination")}>
                Payment methods
              </button>
            )}
            <button
              className="btn"
              onClick={openCreate}
              disabled={!students.length}
            >
              <Plus size={16} />
              Staff-assisted case
            </button>
          </div>
        }
      />
      {error && (
        <div className="form-error page-error">
          {error}
          <button onClick={() => setError("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {notice && <div className="success-banner">{notice}</div>}

      <section className="panel support-destinations">
        <SectionHeader
          title="School payment destinations"
          subtitle="Donors see verified institution-owned channels only. Guardian and learner accounts are never accepted."
        />
        <div className="support-destination-grid">
          {destinations.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.label}</strong>
                <Status
                  tone={
                    item.verification_status === "verified"
                      ? "success"
                      : item.verification_status === "disabled"
                        ? "neutral"
                        : "warning"
                  }
                >
                  {item.verification_status}
                </Status>
              </div>
              <span>
                {item.provider_name} · {item.account_reference}
              </span>
              <small>{item.account_name}</small>
              {item.channel === "stellar" && (
                <small>Testnet only · no real monetary value</small>
              )}
              {school?.role === "owner" &&
                item.verification_status !== "verified" && (
                  <button
                    className="btn compact"
                    disabled={busy}
                    onClick={() => decideDestination(item, "verify")}
                  >
                    Verify method
                  </button>
                )}
              {school?.role === "owner" &&
                item.verification_status === "verified" && (
                  <button
                    className="btn compact"
                    disabled={busy}
                    onClick={() => decideDestination(item, "disable")}
                  >
                    Disable
                  </button>
                )}
            </article>
          ))}
          {!destinations.length && (
            <div className="empty-register">
              <ShieldCheck />
              <strong>No payment destination configured</strong>
              <span>
                An owner must add and verify the school&apos;s SchoolPay, bank,
                institution mobile-money or Stellar testnet account before
                donors can contribute.
              </span>
            </div>
          )}
        </div>
      </section>

      <section
        className="support-workflow"
        aria-label="Campaign publication workflow"
      >
        <div>
          <span>1</span>
          <strong>Refer privately</strong>
        </div>
        <div>
          <span>2</span>
          <strong>Guardian drafts</strong>
        </div>
        <div>
          <span>3</span>
          <strong>School reviews</strong>
        </div>
        <div>
          <span>4</span>
          <strong>Owner publishes</strong>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard
          icon={HandHeart}
          label="Verified support"
          value={money(verified)}
          note={`${cases.length} controlled cases`}
          tone="green"
        />
        <MetricCard
          icon={ShieldCheck}
          label="Campaign targets"
          value={money(target)}
          note="Backed by learner obligations"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Pending settlement"
          value={money(pending)}
          note="Excluded until verified"
          tone="amber"
        />
        <MetricCard
          icon={Bot}
          label="Gemini reviewed"
          value={String(cases.filter((item) => item.has_ai_review).length)}
          note="Human approval remains required"
          tone="blue"
        />
      </section>

      <section className="panel referral-register">
        <SectionHeader
          title="Arrears referral candidates"
          subtitle="Deterministic ledger facts only—these indicators support human outreach and do not predict dropout."
        />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Learner</th>
                <th>Class</th>
                <th>Overdue</th>
                <th>Priority</th>
                <th>Guardian access</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((item) => (
                <tr key={item.student_id}>
                  <td className="entity">
                    <strong>{item.student_name}</strong>
                    <small>{item.admission_no}</small>
                  </td>
                  <td>{item.class_name}</td>
                  <td>
                    <strong>{money(item.overdue_amount)}</strong>
                    <small>{item.days_overdue} days</small>
                  </td>
                  <td>
                    <Status
                      tone={
                        item.priority_band === "urgent"
                          ? "danger"
                          : item.priority_band === "high"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {item.priority_band}
                    </Status>
                  </td>
                  <td>
                    {item.guardian_portal_linked
                      ? "Verified portal link"
                      : item.guardian_email || "Guardian email missing"}
                  </td>
                  <td>
                    {item.referral_id ? (
                      <Status
                        tone={
                          item.referral_status === "consented"
                            ? "success"
                            : "info"
                        }
                      >
                        {item.referral_status}
                      </Status>
                    ) : item.guardian_portal_linked ? (
                      <button
                        className="btn compact"
                        disabled={busy}
                        onClick={() => createReferral(item)}
                      >
                        Send referral
                      </button>
                    ) : item.guardian_link_id ? (
                      <button
                        className="btn compact"
                        disabled={busy || !item.guardian_email}
                        onClick={() => inviteGuardian(item.guardian_link_id!)}
                      >
                        Create invite
                      </button>
                    ) : (
                      <span className="muted-action">Add guardian</span>
                    )}
                  </td>
                </tr>
              ))}
              {!candidates.length && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-register">
                      <ShieldCheck />
                      <strong>No overdue referral candidates</strong>
                      <span>
                        Only learners with a calculated overdue installment
                        appear here.
                      </span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {guardianInvite && (
          <div className="guardian-invite-result">
            <span>Private link for {guardianInvite.email}</span>
            <code>{`${window.location.origin}${guardianInvite.path}`}</code>
            <button
              className="btn compact"
              onClick={() =>
                navigator.clipboard.writeText(
                  `${window.location.origin}${guardianInvite.path}`,
                )
              }
            >
              <Copy size={13} />
              Copy link
            </button>
          </div>
        )}
      </section>

      <div className="content-grid support-admin-grid">
        <section className="panel">
          <SectionHeader
            title="Support cases"
            subtitle="Drafts remain private; published cases appear automatically in the donor portal."
          />
          {cases.map((item) => (
            <button
              className={`support-case-row ${selected?.id === item.id ? "selected" : ""}`}
              key={item.id}
              onClick={() => openCase(item.id)}
            >
              <div>
                <strong>{item.student_name}</strong>
                <small>
                  {item.admission_no} · {item.public_code}
                </small>
              </div>
              <div>
                <span>{item.title}</span>
                <small>
                  {money(item.verified_amount)} of {money(item.target_amount)}
                </small>
              </div>
              <Status
                tone={
                  item.status === "funded"
                    ? "success"
                    : item.status === "published"
                      ? "info"
                      : "neutral"
                }
              >
                {item.status}
              </Status>
            </button>
          ))}
          {!cases.length && (
            <div className="empty-register">
              <HandHeart />
              <strong>No learner support cases</strong>
              <span>
                {students.length
                  ? "Start with a learner who has an outstanding fee or payable requirement."
                  : "Register learners and publish their fees or requirements before creating a support case."}
              </span>
              {students.length ? (
                <button className="btn primary" onClick={openCreate}>
                  <Plus size={15} />
                  Create first case
                </button>
              ) : (
                <div className="empty-actions">
                  <Link className="btn" href="/students">
                    Register learners
                  </Link>
                  <Link className="btn" href="/requirements">
                    Set requirements
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        <aside className="panel support-case-detail">
          <SectionHeader
            title={selected?.title ?? "Case workflow"}
            subtitle={
              selected
                ? `${selected.student.name} · ${selected.student.admission_no}`
                : "Select a case to continue"
            }
          />
          {selected && (
            <div className="support-admin-body">
              <div className="support-admin-progress">
                <span>
                  1. Consent <b>{selected.consent ? "Complete" : "Required"}</b>
                </span>
                <span>
                  2. Submission{" "}
                  <b>
                    {selected.guardian_authored
                      ? selected.status
                      : "Staff assisted"}
                  </b>
                </span>
                <span>
                  3. Safety review{" "}
                  <b>
                    {selected.ai_review
                      ? "Gemini complete"
                      : selected.consent?.gemini_processing
                        ? "Gemini pending"
                        : "Manual"}
                  </b>
                </span>
                <span>
                  4. Publication <b>{selected.status}</b>
                </span>
              </div>
              <p>{selected.public_summary}</p>
              {selected.private_context && (
                <div className="support-private-context">
                  <strong>Private guardian context</strong>
                  <p>{selected.private_context}</p>
                  <small>Never shown on the public donor portal.</small>
                </div>
              )}
              {selected.consent?.public_media_consent &&
                school?.role === "owner" && (
                  <div className="support-private-context support-media-manager">
                    <strong>Consented campaign image</strong>
                    {selected.media?.status === "approved" && (
                      <Image
                        src={`${API}/api/v1/support/cases/${selected.id}/media?v=${selected.media.content_hash.slice(0, 12)}`}
                        alt={selected.media.alt_text}
                        width={selected.media.width}
                        height={selected.media.height}
                        unoptimized
                      />
                    )}
                    <p>
                      {selected.media?.status === "approved"
                        ? selected.media.alt_text
                        : "No public image has been approved yet."}
                    </p>
                    <small>
                      The server removes metadata, resizes and re-encodes every
                      approved image.
                    </small>
                    <div className="support-case-actions">
                      <button
                        className="btn"
                        onClick={() => {
                          setModalError("");
                          setModal("media");
                        }}
                      >
                        {selected.media?.status === "approved"
                          ? "Replace image"
                          : "Add image"}
                      </button>
                      {selected.media?.status === "approved" && (
                        <button
                          className="btn"
                          disabled={busy}
                          onClick={removeMedia}
                        >
                          Remove image
                        </button>
                      )}
                    </div>
                  </div>
                )}
              <div className="support-case-actions">
                {school?.role === "owner" &&
                  !["funded", "closed", "withdrawn"].includes(
                    selected.status,
                  ) && (
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => {
                        setModalError("");
                        setModal("edit");
                      }}
                    >
                      <Pencil size={14} />
                      Edit campaign
                    </button>
                  )}
                {!selected.consent && (
                  <button
                    className="btn"
                    onClick={() => {
                      setModalError("");
                      setModal("consent");
                    }}
                  >
                    Record consent
                  </button>
                )}
                {selected.guardian_authored &&
                  selected.status === "submitted" &&
                  ["owner", "bursar"].includes(school?.role ?? "") && (
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => reviewDecision("request_changes")}
                    >
                      Request changes
                    </button>
                  )}
                {selected.guardian_authored &&
                  selected.consent?.gemini_processing &&
                  !selected.ai_review &&
                  ["submitted", "approved", "published"].includes(
                    selected.status,
                  ) &&
                  ["owner", "bursar"].includes(school?.role ?? "") && (
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => review()}
                    >
                      Run consented Gemini review
                    </button>
                  )}
                {selected.guardian_authored &&
                  selected.status === "submitted" &&
                  school?.role === "owner" &&
                  (!selected.consent?.gemini_processing ||
                    selected.ai_review) && (
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={() => reviewDecision("approve")}
                    >
                      Approve case
                    </button>
                  )}
                {selected.guardian_authored &&
                  selected.status === "approved" &&
                  school?.role === "owner" && (
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={publish}
                    >
                      Publish campaign
                    </button>
                  )}
                {!selected.guardian_authored &&
                  selected.consent &&
                  !selected.ai_review && (
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={() => review()}
                    >
                      Run Gemini review
                    </button>
                  )}
                {selected.consent?.gemini_processing &&
                  !selected.ai_review &&
                  ["review", "submitted", "approved", "published"].includes(
                    selected.status,
                  ) && (
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => evidenceInputRef.current?.click()}
                    >
                      Review redacted image
                    </button>
                  )}
                {!selected.guardian_authored &&
                  selected.ai_review &&
                  selected.status === "review" &&
                  school?.role === "owner" && (
                    <button
                      className="btn primary"
                      disabled={busy}
                      onClick={publish}
                    >
                      Approve & publish
                    </button>
                  )}
                {selected.status === "submitted" &&
                  school?.role !== "owner" && (
                    <span className="support-owner-note">
                      An institution owner must give final approval.
                    </span>
                  )}
                {["published", "funded", "closed"].includes(
                  selected.status,
                ) && (
                  <>
                    <Link
                      className="btn"
                      href={`/support/${selected.public_code}`}
                      target="_blank"
                    >
                      Public record <ExternalLink size={14} />
                    </Link>
                    <button
                      className="btn"
                      onClick={() => {
                        setModalError("");
                        setModal("proof");
                      }}
                    >
                      Add proof update
                    </button>
                  </>
                )}
                {school?.role === "owner" &&
                  !["funded", "closed", "withdrawn"].includes(
                    selected.status,
                  ) && (
                    <button
                      className="btn danger-link"
                      disabled={busy || pledges.length > 0}
                      title={
                        pledges.length
                          ? "Campaigns with donor activity must retain their tracking record"
                          : "Delete campaign from public access"
                      }
                      onClick={deleteCampaign}
                    >
                      <Trash2 size={14} />
                      Delete campaign
                    </button>
                  )}
              </div>
              {selected.ai_review && (
                <div className="support-review">
                  <strong>Gemini recommendation</strong>
                  <p>{selected.ai_review.recommended_action}</p>
                  {selected.ai_review.consistency_flags.length > 0 && (
                    <small>
                      Flags: {selected.ai_review.consistency_flags.join(" · ")}
                    </small>
                  )}
                </div>
              )}
              <h3>Guardian portal access</h3>
              <p className="muted-action">
                Invitations expire after 72 hours, work once, and require the
                guardian&apos;s registered email.
              </p>
              {selected.guardians.map((guardian) => (
                <div className="guardian-access-row" key={guardian.id}>
                  <div>
                    <strong>{guardian.name}</strong>
                    <small>{guardian.relationship}</small>
                  </div>
                  {guardian.portal_linked ? (
                    <span className="muted-action">
                      <ShieldCheck size={14} /> Portal linked
                    </span>
                  ) : (
                    <button
                      className="btn compact"
                      disabled={busy}
                      onClick={() => inviteGuardian(guardian.id)}
                    >
                      <UserRoundPlus size={14} />
                      Create invite
                    </button>
                  )}
                </div>
              ))}
              {guardianInvite && (
                <div className="guardian-invite-result">
                  <span>Private link for {guardianInvite.email}</span>
                  <code>{`${window.location.origin}${guardianInvite.path}`}</code>
                  <button
                    className="btn compact"
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}${guardianInvite.path}`,
                      )
                    }
                  >
                    <Copy size={13} />
                    Copy link
                  </button>
                </div>
              )}
              <h3>Contributions</h3>
              {pledges.map((item) => (
                <div className="support-pledge-row" key={item.id}>
                  <div>
                    <strong>{item.donor_display_name}</strong>
                    <small>
                      {item.public_reference} · {item.external_reference}
                    </small>
                  </div>
                  <b>{money(item.amount)}</b>
                  {item.status === "pending" ? (
                    <span>
                      <button onClick={() => decide(item, "verify")}>
                        Verify
                      </button>
                      <button onClick={() => decide(item, "reject")}>
                        Reject
                      </button>
                    </span>
                  ) : (
                    <span>
                      <Status
                        tone={
                          item.status === "verified" ? "success" : "neutral"
                        }
                      >
                        {item.status}
                      </Status>
                      {item.status === "verified" && (
                        <>
                          <button onClick={() => reissue(item)}>
                            Reissue receipt
                          </button>
                          {school?.role === "owner" && (
                            <button onClick={() => reverse(item)}>
                              Reverse
                            </button>
                          )}
                        </>
                      )}
                    </span>
                  )}
                </div>
              ))}
              {!pledges.length && (
                <p className="muted-action">No contributions recorded.</p>
              )}
            </div>
          )}
        </aside>
      </div>

      {modal === "case" && (
        <Modal title="Create private support case" close={() => setModal(null)}>
          <form className="modal-form" onSubmit={createCase}>
            <label>
              Learner
              <select
                required
                value={caseStudentId}
                onChange={(event) => {
                  setCaseStudentId(event.target.value);
                  setRequirementId("");
                  setTargetAmount("");
                  setGeneralOutstanding(0);
                  setModalError("");
                }}
              >
                <option value="">Select learner</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.admission_no} · {student.full_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Obligation being supported
              <select
                value={requirementId}
                disabled={!caseStudentId || obligationsLoading}
                onChange={(event) => chooseRequirement(event.target.value)}
              >
                <option value="">
                  {obligationsLoading
                    ? "Loading verified balance…"
                    : `School fees / general balance · ${money(generalOutstanding)} outstanding`}
                </option>
                {requirements.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.requirement_name} · {money(item.outstanding_amount)}{" "}
                    outstanding
                  </option>
                ))}
              </select>
              <small>
                Choosing a requirement links every verified contribution to that
                exact obligation.
              </small>
            </label>
            <label>
              Need category
              <select name="need_category">
                <option value="fees">School fees</option>
                <option value="examination">Examination</option>
                <option value="uniform">Uniform</option>
                <option value="learning_materials">Learning materials</option>
                <option value="meals">Meals</option>
                <option value="transport">Transport</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Public campaign title
              <input name="title" minLength={4} required />
            </label>
            <label>
              Target amount (UGX)
              <input
                type="number"
                min="1"
                max={obligationLimit || undefined}
                required
                value={targetAmount}
                onChange={(event) => {
                  setTargetAmount(event.target.value);
                  setModalError("");
                }}
              />
              <small>
                {caseStudentId && !obligationsLoading
                  ? `${money(obligationLimit)} is the maximum verified amount for this obligation.`
                  : "Select a learner to load the verified amount."}
              </small>
            </label>
            <label>
              Anonymous public summary
              <textarea
                name="public_summary"
                minLength={20}
                required
                placeholder="Describe the verified need without a name, admission number, image or identifying family detail."
              />
            </label>
            {modalError && (
              <div className="form-error modal-error" role="alert">
                {modalError}
              </div>
            )}
            <div className="notice">
              Targets above the learner&apos;s live obligation and identifying
              public text are rejected.
            </div>
            <footer>
              <button
                type="button"
                className="btn"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                disabled={
                  busy ||
                  obligationsLoading ||
                  !obligationLimit ||
                  Number(targetAmount) <= 0 ||
                  Number(targetAmount) > obligationLimit
                }
              >
                {busy ? "Creating…" : "Create case"}
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {modal === "consent" && selected && (
        <Modal
          title="Record scoped guardian consent"
          close={() => setModal(null)}
        >
          <form className="modal-form" onSubmit={consent}>
            <label>
              Linked guardian
              <select name="guardian_link_id" required>
                <option value="">Select guardian</option>
                {selected.guardians.map((guardian) => (
                  <option key={guardian.id} value={guardian.id}>
                    {guardian.name} · {guardian.relationship}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Consent evidence
              <select name="method">
                <option value="signed_form">Signed form</option>
                <option value="witnessed_in_person">Witnessed in person</option>
                <option value="otp">Verified OTP</option>
              </select>
            </label>
            <label>
              Learner assent
              <select name="child_assent_status">
                <option value="agreed">Learner agreed</option>
                <option value="not_applicable">Not applicable</option>
                <option value="unable_to_express">Unable to express</option>
                <option value="declined">Learner declined</option>
              </select>
            </label>
            <label className="portal-check">
              <input name="public_media_consent" type="checkbox" />
              The guardian separately consents to one safeguarding-reviewed
              learner photograph being public and understands this can be
              withdrawn.
            </label>
            {modalError && (
              <div className="form-error modal-error" role="alert">
                {modalError}
              </div>
            )}
            <div className="notice">
              Names, admission numbers and contact details always stay private.
              A photograph is optional and requires the separate checkbox above.
            </div>
            <footer>
              <button
                type="button"
                className="btn"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                Record consent
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {modal === "edit" && selected && (
        <Modal title="Edit campaign" close={() => setModal(null)}>
          <form className="modal-form" onSubmit={editCampaign}>
            <label>
              Public campaign title
              <input
                name="title"
                minLength={4}
                maxLength={120}
                required
                defaultValue={selected.title}
              />
            </label>
            <label>
              Need category
              <select
                name="need_category"
                defaultValue={selected.need_category}
              >
                <option value="fees">School fees</option>
                <option value="examination">Examination</option>
                <option value="uniform">Uniform</option>
                <option value="learning_materials">Learning materials</option>
                <option value="meals">Meals</option>
                <option value="transport">Transport</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Target amount (UGX)
              <input
                name="target_amount"
                type="number"
                min={Math.max(
                  1,
                  Number(selected.verified_amount) +
                    Number(selected.pending_amount),
                )}
                step="0.01"
                required
                defaultValue={selected.target_amount}
                readOnly={pledges.length > 0}
              />
              <small>
                {pledges.length
                  ? "The target is locked because a donor payment has been prepared."
                  : "The server will reject amounts above the learner’s verified live obligation."}
              </small>
            </label>
            <label>
              Anonymous public summary
              <textarea
                name="public_summary"
                minLength={20}
                maxLength={500}
                required
                defaultValue={selected.public_summary}
              />
            </label>
            {modalError && (
              <div className="form-error modal-error" role="alert">
                {modalError}
              </div>
            )}
            <div className="notice">
              Never add a learner name, admission number, exact location or
              contact detail. Published edits take effect immediately and are
              audit logged.
            </div>
            <footer>
              <button
                type="button"
                className="btn"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "Saving…" : "Save campaign changes"}
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {modal === "media" && selected && (
        <Modal title="Approve campaign image" close={() => setModal(null)}>
          <form className="modal-form" onSubmit={media}>
            <label>
              Learner image
              <input
                name="image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
              />
              <small>
                JPEG, PNG or WebP, maximum 1.5 MB and at least 320 × 240.
              </small>
            </label>
            <label>
              Public alternative text
              <input
                name="alt_text"
                minLength={8}
                maxLength={160}
                required
                placeholder="Learner holding school books outdoors"
              />
              <small>
                Describe the scene without the learner&apos;s name, class,
                admission number or location.
              </small>
            </label>
            <label className="portal-check">
              <input name="guardian_confirmation" type="checkbox" required />I
              checked the recorded guardian consent specifically permits a
              public photograph.
            </label>
            <label className="portal-check">
              <input
                name="safeguarding_confirmation"
                type="checkbox"
                required
              />
              An institution owner reviewed the image for uniforms, badges,
              documents, locations and other identifying risks.
            </label>
            {modalError && (
              <div className="form-error modal-error" role="alert">
                {modalError}
              </div>
            )}
            <div className="notice">
              Uploading approves this exact sanitized image. HarambeeOne strips
              metadata, resizes it and stores a content fingerprint for audit.
            </div>
            <footer>
              <button
                type="button"
                className="btn"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "Sanitizing…" : "Approve image"}
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {modal === "proof" && selected && (
        <Modal
          title="Submit private outcome evidence"
          close={() => setModal(null)}
        >
          <form className="modal-form" onSubmit={proof}>
            <label>
              Proof type
              <select name="attestation_type">
                <option value="fulfilment">Obligation fulfilled</option>
                <option value="enrolment">Enrolment continuity</option>
                <option value="guardian_acknowledgement">
                  Guardian acknowledgement
                </option>
                <option value="independent_audit">Independent audit</option>
              </select>
            </label>
            <label>
              Attendance band
              <select name="attendance_band">
                <option value="">Not applicable</option>
                <option value="below_50">Below 50%</option>
                <option value="50_to_69">50–69%</option>
                <option value="70_to_79">70–79%</option>
                <option value="80_to_89">80–89%</option>
                <option value="90_plus">90%+</option>
              </select>
            </label>
            <label>
              Private evidence statement
              <textarea
                name="statement"
                minLength={10}
                required
                placeholder="Factual update for the owner to redact and review."
              />
            </label>
            {modalError && (
              <div className="form-error modal-error" role="alert">
                {modalError}
              </div>
            )}
            <div className="notice">
              An owner must approve a redacted version before donors can see
              this update.
            </div>
            <footer>
              <button
                type="button"
                className="btn"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                Submit for review
              </button>
            </footer>
          </form>
        </Modal>
      )}

      {modal === "destination" && school && (
        <Modal
          title="Add school payment destination"
          close={() => setModal(null)}
        >
          <form className="modal-form" onSubmit={createDestination}>
            <label>
              Payment channel
              <select name="channel">
                <option value="schoolpay">SchoolPay</option>
                <option value="bank">Bank account</option>
                <option value="mobile_money">Institution mobile money</option>
                <option value="stellar">Stellar Testnet (demo only)</option>
              </select>
            </label>
            <label>
              Display label
              <input
                name="label"
                minLength={2}
                required
                placeholder="SchoolPay fees code"
              />
            </label>
            <label>
              Provider or bank
              <input
                name="provider_name"
                minLength={2}
                required
                placeholder="SchoolPay, Stanbic Bank, MTN…"
              />
            </label>
            <label>
              Institution account name
              <input value={school.name} readOnly />
              <small>
                For safety, this must match the registered institution.
              </small>
            </label>
            <label>
              Account number, school code or Stellar public key
              <input name="account_reference" minLength={3} required />
              <small>
                For Stellar, enter the school&apos;s public G… account only.
                Never enter a secret key.
              </small>
            </label>
            <label>
              Public payment instructions
              <textarea
                name="instructions"
                minLength={10}
                required
                placeholder="Explain how a donor pays and retrieves the provider reference."
              />
            </label>
            {modalError && (
              <div className="form-error modal-error" role="alert">
                {modalError}
              </div>
            )}
            <footer>
              <button
                type="button"
                className="btn"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                {busy ? "Saving…" : "Save payment method"}
              </button>
            </footer>
          </form>
        </Modal>
      )}
    </>
  );
}

function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <header>
          <h2>{title}</h2>
          <button onClick={close}>
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () =>
      reject(new Error("Evidence image could not be read."));
    reader.readAsDataURL(file);
  });
}

async function apiBody<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `The service returned an invalid response (${response.status}). Please retry.`,
    );
  }
}

function apiError(detail: unknown, status: number): string {
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const issue = item as { loc?: unknown; msg?: unknown };
      const field = Array.isArray(issue.loc)
        ? String(issue.loc.at(-1) ?? "").replaceAll("_", " ")
        : "";
      const message = typeof issue.msg === "string" ? issue.msg : "";
      return message ? [`${field ? `${field}: ` : ""}${message}`] : [];
    });
    if (messages.length) return messages.join(" · ");
  }
  return `The action could not be completed (${status}). Check the entered information and try again.`;
}
