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

export const router = createBrowserRouter([
    { path: "/", element: <App /> },
    { path: "/signup", element: <Signup /> },
    { path: "/signin", element: <Signin /> },
    { path: "/dashboard", element: <Dashboard /> },
    { path: "/wallet", element: <Wallet /> },
    { path: "/profile", element: <Profile /> },
    { path: "/admin", element: <Admin /> },
    { path: "/settings", element: <Settings /> },
    { path: "/games/:id", element: <GameDescription /> },
    { path: "/play/blackjack", element: <Blackjack /> },
    { path: "/play/tictactoe", element: <TicTacToe /> },
    { path: "/play/minesweeper", element: <Minesweeper /> },
]); 
