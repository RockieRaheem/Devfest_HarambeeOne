import PasswordRecovery from '@/components/PasswordRecovery';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ oobCode?: string }>;
}) {
  const params = await searchParams;
  return <PasswordRecovery mode="update" oobCode={params.oobCode}/>;
}
