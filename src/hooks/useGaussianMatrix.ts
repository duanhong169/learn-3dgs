import { useMemo } from 'react';

import { buildCovarianceMatrix } from '@/utils/math';
import { formatMatrix3 } from '@/utils/gaussian';

import type { Tuple3 } from '@/types/common';
import type { Matrix3 } from '@/types/gaussian';

/**
 * Computes the 3×3 covariance matrix from rotation and scale parameters.
 * Returns both the raw matrix and a formatted version for display.
 */
export function useGaussianMatrix(
  scale: Tuple3,
  rotation: Tuple3,
): { covariance: Matrix3; formatted: string[][] } {
  return useMemo(() => {
    const covariance = buildCovarianceMatrix(scale, rotation);
    const formatted = formatMatrix3(covariance);
    return { covariance, formatted };
  }, [scale, rotation]);
}
