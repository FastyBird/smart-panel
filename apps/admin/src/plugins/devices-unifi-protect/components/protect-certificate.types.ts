import type { IProtectCertificate } from '../store/protect.types';

import type { ProtectTrustable } from './protect-config-form.utils';

export interface IProtectCertificateProps {
	certificate: IProtectCertificate;
	trustable: ProtectTrustable;
}
