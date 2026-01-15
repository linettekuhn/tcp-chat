import { useEffect, useRef, useState } from "react";
import { IoHelpCircleOutline } from "react-icons/io5";
import { IoHelpCircle } from "react-icons/io5";
import styles from "./HelpIcon.module.css";

export default function HelpIcon() {
  const [isOpen, setIsOpen] = useState(false);
  const helpTextRef = useRef<HTMLUListElement>(null);

  const openDialog = () => setIsOpen(true);
  const closeDialog = () => setIsOpen(false);

  // add event listener to document for closing dialog when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (helpTextRef.current) {
        if (!helpTextRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  return (
    <div className={styles.helpIcon}>
      {isOpen && (
        <ul ref={helpTextRef} className={styles.helpText}>
          <p>This is the website frontend for my C++ TCP Chat Server!</p>
          <li>
            <b>Create:</b> Go to the Server page and start a server.
          </li>
          <li>
            <b>Connect:</b> Use the same IP and port from the server setup.
          </li>
          <li>
            <b>Commands:</b> Type <code>~help</code> in chat for options.
          </li>
        </ul>
      )}
      <button className={styles.helpButton}>
        {isOpen ? (
          <IoHelpCircle onClick={closeDialog} />
        ) : (
          <IoHelpCircleOutline onClick={openDialog} />
        )}
      </button>
    </div>
  );
}
