import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

// Pre-typed versions of the react-redux hooks, so components never repeat the generics.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
