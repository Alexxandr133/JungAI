import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { UniversalNavbar } from '../../components/UniversalNavbar';
import { PsychologistNavbar } from '../../components/PsychologistNavbar';
import { useAuth } from '../../context/AuthContext';
import { useMessengerUiOptional } from '../../context/MessengerUiContext';
import { VerificationRequired } from '../../components/VerificationRequired';
import { checkVerification, type VerificationCheckResult, type VerificationStatus } from '../../utils/verification';
import { MessengerPanel } from '../../messenger/MessengerPanel';

/** Full-page messenger (/messages, /chat) — same panel as drawer */
export default function ChatPage() {
  const { token, user } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const messengerUi = useMessengerUiOptional();
  const isPsychologist = user?.role === 'psychologist' || user?.role === 'admin';
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus | null>(null);

  const roomId = params.get('roomId') || messengerUi?.roomId || null;

  useEffect(() => {
    if (params.get('openDrawer') === '1' && messengerUi) {
      messengerUi.openMessenger({ roomId: params.get('roomId') });
    }
  }, [location.search, messengerUi, params]);

  useEffect(() => {
    if (!token || !isPsychologist) {
      setIsVerified(null);
      return;
    }
    checkVerification(token).then((result: VerificationCheckResult) => {
      setIsVerified(result.isVerified);
      setVerificationStatus(result.status);
    });
  }, [token, isPsychologist]);

  if (isPsychologist && token && isVerified === false) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <PsychologistNavbar />
        <VerificationRequired verificationStatus={verificationStatus} />
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'var(--bg, var(--surface))'
      }}
    >
      <UniversalNavbar />
      <main style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <MessengerPanel mode="full" initialRoomId={roomId} />
      </main>
    </div>
  );
}
