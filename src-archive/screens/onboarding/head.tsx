import type { ReactNode } from 'react';
import { FacesArt, FeedArt, FilmArt, PeopleArt, PhotoStack, StepHead } from '@/kit';
import { useStrings } from '@/lib/language';
import type { Strings } from '@/strings';
import f01 from '../../../assets/images/onboarding/f01.jpg';
import f02 from '../../../assets/images/onboarding/f02.jpg';
import f03 from '../../../assets/images/onboarding/f03.jpg';
import f04 from '../../../assets/images/onboarding/f04.jpg';
import f05 from '../../../assets/images/onboarding/f05.jpg';
import f06 from '../../../assets/images/onboarding/f06.jpg';
import f07 from '../../../assets/images/onboarding/f07.jpg';
import f08 from '../../../assets/images/onboarding/f08.jpg';
import f09 from '../../../assets/images/onboarding/f09.jpg';
import f10 from '../../../assets/images/onboarding/f10.jpg';
import f11 from '../../../assets/images/onboarding/f11.jpg';
export type Step = 1 | 2 | 3 | 4 | 5;
const HEADS: Record<
  Step,
  (s: Strings) => {
    art: ReactNode;
    title: string;
    lead: string;
  }
> = {
  1: (s) => ({
    art: <PhotoStack photos={[f05, f10, f09]} />,
    title: 'Remember',
    lead: s.login.promise,
  }),
  2: (s) => ({ art: <FeedArt photos={[f01, f02, f03, f04, f06, f07]} />, ...s.login.feed }),
  3: (s) => ({ art: <FilmArt photo={f11} />, ...s.login.film }),
  4: (s) => ({ art: <FacesArt photo={f08} />, title: s.consent.title, lead: s.consent.lead }),
  5: (s) => ({ art: <PeopleArt />, title: s.username.title, lead: s.username.intro }),
};
export function OnboardingHead({
  step,
  back,
  children,
}: {
  step: Step;
  back?: () => void;
  children?: ReactNode;
}) {
  const s = useStrings();
  const { art, title, lead } = HEADS[step](s);
  return (
    <StepHead
      art={art}
      title={title}
      lead={lead}
      first={step === 1}
      back={back ? { label: s.action.back, onPress: back } : undefined}
    >
      {children}
    </StepHead>
  );
}
