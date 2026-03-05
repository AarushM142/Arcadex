import { createBrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import Signup from "./components/Signup.jsx";
import Signin from "./components/Singin.jsx";
import Dashboard from "./components/Dashboard.jsx";
import Wallet from "./components/Wallet.jsx";
import Profile from "./components/Profile.jsx";
import Admin from "./components/Admin.jsx";
import Settings from "./components/Settings.jsx";
import GameDescription from "./components/GameDescription.jsx";
import Blackjack from "./components/Blackjack.jsx";
import TicTacToe from "./components/TicTacToe.jsx";
import Minesweeper from "./components/Minesweeper.jsx";
import TrialByCombat from "./components/TrialByCombat.jsx";

// This object acts as the "Traffic Cop" for our Single Page Application
// Whenever the user types a specific URL (like /dashboard), the Router looks at this list
// and instantly drops the matching React Component onto the screen.
export const router = createBrowserRouter([
    { path: "/", element: <App /> }, // The default root path drops the user into the App.jsx file
    { path: "/signup", element: <Signup /> },
    { path: "/signin", element: <Signin /> },
    { path: "/dashboard", element: <Dashboard /> },
    { path: "/wallet", element: <Wallet /> },
    { path: "/profile", element: <Profile /> },
    { path: "/admin", element: <Admin /> },
    { path: "/settings", element: <Settings /> },

    // Dynamic Route: The ":id" tells the router that the last part of the URL is a variable.
    // E.g. /games/blackjack or /games/tictactoe will both load the GameDescription component, 
    // and pass the word "blackjack" or "tictactoe" to the component as a parameter.
    { path: "/games/:id", element: <GameDescription /> },

    { path: "/play/blackjack", element: <Blackjack /> },
    { path: "/play/tictactoe", element: <TicTacToe /> },
    { path: "/play/minesweeper", element: <Minesweeper /> },
    { path: "/play/trial-combat", element: <TrialByCombat /> },
]); 
