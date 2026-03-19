import { CallIntelligenceView } from './SDRCallIntelligencePage';
import { CloserSelfUploadSection } from '@/components/closer/CloserSelfUploadSection';

const CloserCallIntelligencePage = () => (
  <CallIntelligenceView
    context="demo_closer"
    uploadSlot={<CloserSelfUploadSection />}
  />
);
export default CloserCallIntelligencePage;
