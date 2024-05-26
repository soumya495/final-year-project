import { Player } from '@lottiefiles/react-lottie-player';
import PendingLottieFile from '../../../data/lottie/Pending.json'
import HospitalDetails from './HospitalDetails';

export default function HospitalApprovalPendingView() {

    return (
        <>
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-84px)]">
                <Player
                    autoplay
                    keepLastFrame
                    src={PendingLottieFile}
                    style={{ height: '250px', width: '250px' }}
                />
                <div>
                <h3 className='font-semibold text-lg max-w-xl mx-auto text-center'>
                    Your account is under review. You will be notified once your account is approved.
                </h3>
                <HospitalDetails />
                </div>
            </div>
        </>
    )
}